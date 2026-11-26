import dotenv from 'dotenv';
dotenv.config();

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { supabaseAdmin } from '../lib/supabase';
import { buildRoster, MIN_SECRET_LENGTH, TRAINING_EVENT, type SeedAccount } from '../seed/training-event.data';
import { KEEP_CODES, selectRetiredAccounts, selectionProblems } from '../seed/training-event.retire';
import { rosterRowOf, type RosterRow, type SeedDb } from '../seed/training-event.seed';

// Reduce el evento «Conoce MUNET» de 40 a 12 cuentas. Simula por defecto: lista qué retiraría y no
// escribe nada.
//
//   npx ts-node --files src/scripts/retire-training-extra-accounts.ts                    (simulación)
//   npx ts-node --files src/scripts/retire-training-extra-accounts.ts --apply            (retira)
//   npx ts-node --files src/scripts/retire-training-extra-accounts.ts --credentials      (regenera el listado de 12, local)
//
// Retirar = borrado lógico de la membresía (deleted_at) y borrado de su usuario de acceso en Auth.
// Solo toca membresías de `conoce-munet` cuyo código está en la lista de 28. Si el evento no existe,
// falta alguna cuenta de las 12 o la selección no cuadra, aborta antes de escribir nada.
// Aplicar requiere la autorización expresa de la persona dueña en ese momento.
//
// --credentials no toca la base: escribe el listado de las 12 cuentas (mismo formato que el seed)
// usando el secreto existente. No crea secretos nuevos: si no hay secreto, aborta.
// --out <ruta>: destino del listado (por defecto .local/usuarios-entrenamiento.json).

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const credentials = args.includes('--credentials');
const outIndex = args.indexOf('--out');
const repoLocal = resolve(__dirname, '../../../../.local');
const out = resolve(outIndex >= 0 && args[outIndex + 1] ? args[outIndex + 1] : resolve(repoLocal, 'usuarios-entrenamiento.json'));

type Row = Record<string, any>;
type MembershipRow = { id: string; user_id: string; participant_code: string | null; delegation_code?: string | null };

const fail = (message: string): never => {
  throw new Error(message);
};
const check = (result: { error?: { message: string } | null }, what: string) => {
  if (result.error) fail(`${what}: ${result.error.message}`);
};

// Solo lee el secreto existente. Nunca crea uno: con otro secreto las contraseñas cambiarían.
const readSecret = (): string => {
  const fromEnv = process.env.TRAINING_SEED_SECRET?.trim();
  if (fromEnv) {
    if (fromEnv.length < MIN_SECRET_LENGTH) fail('TRAINING_SEED_SECRET es demasiado corto');
    return fromEnv;
  }
  const file = resolve(repoLocal, 'training-seed-secret');
  if (existsSync(file)) {
    const fromFile = readFileSync(file, 'utf8').trim();
    if (fromFile.length < MIN_SECRET_LENGTH) fail(`${file} tiene un secreto demasiado corto`);
    return fromFile;
  }
  return fail('No hay secreto del seed (TRAINING_SEED_SECRET ni .local/training-seed-secret). No se crea uno nuevo.');
};

const main = async () => {
  const db = supabaseAdmin as unknown as SeedDb;
  const roster = buildRoster();
  const nameOf = new Map<string, SeedAccount>(roster.map((account) => [account.code, account]));

  // 1. El evento debe existir y ser el de entrenamiento.
  const event = (await db.from('events').select('id, name, slug').eq('slug', TRAINING_EVENT.slug).is('deleted_at', null).maybeSingle()) as { data: Row | null; error: any };
  check(event, 'No se pudo consultar el evento');
  if (!event.data) fail(`No existe el evento ${TRAINING_EVENT.slug}. No se escribe nada.`);
  if (event.data!.slug !== TRAINING_EVENT.slug || event.data!.name !== TRAINING_EVENT.name) {
    fail(`El evento ${TRAINING_EVENT.slug} no tiene el nombre esperado (${event.data!.name}). No se toca.`);
  }
  const eventId = event.data!.id as string;

  // 2. Membresías activas del evento y selección.
  const membershipsResult = (await db
    .from('event_memberships')
    .select('id, user_id, participant_code, account_status, role, delegation_code')
    .eq('event_id', eventId)
    .is('deleted_at', null)) as { data: Row[] | null; error: any };
  check(membershipsResult, 'No se pudieron consultar las membresías');
  const memberships: MembershipRow[] = (membershipsResult.data ?? []) as MembershipRow[];

  const selection = selectRetiredAccounts(memberships);
  const problems = selectionProblems(selection, memberships.length);
  if (problems.length > 0) fail(`Selección no válida, no se escribe nada:\n- ${problems.join('\n- ')}`);

  // 3. Usuarios de acceso de las cuentas a retirar y de las que se quedan.
  const userIds = [...new Set([...selection.retire, ...selection.keep].map((m) => m.user_id as string))];
  const usersResult = (await db.from('users').select('id, supabase_auth_user_id, email').in('id', userIds)) as { data: Row[] | null; error: any };
  check(usersResult, 'No se pudieron consultar los usuarios');
  const usersById = new Map<string, Row>((usersResult.data ?? []).map((u) => [u.id as string, u]));

  // 4. Seguridad: la persona de una cuenta a retirar no puede tener otra membresía activa (otro evento
  // o una de las que se quedan). Si la tiene, borrar su acceso la dejaría fuera de otro lugar.
  const keepUserIds = new Set(selection.keep.map((m) => m.user_id as string));
  const sharedWithKeep = selection.retire.filter((m) => keepUserIds.has(m.user_id as string)).map((m) => m.participant_code);
  if (sharedWithKeep.length > 0) fail(`Cuentas a retirar que comparten persona con una de las que se quedan: ${sharedWithKeep.join(', ')}. No se escribe nada.`);

  const otherMembershipsResult = (await db
    .from('event_memberships')
    .select('user_id, event_id, participant_code')
    .in('user_id', userIds)
    .is('deleted_at', null)) as { data: Row[] | null; error: any };
  check(otherMembershipsResult, 'No se pudieron consultar las membresías de otros eventos');
  const retiredUserIds = new Set(selection.retire.map((m) => m.user_id as string));
  const elsewhere = (otherMembershipsResult.data ?? []).filter((row) => retiredUserIds.has(row.user_id) && row.event_id !== eventId);
  if (elsewhere.length > 0) {
    fail(`Una cuenta a retirar tiene membresía en otro evento (${elsewhere.map((r) => r.participant_code).join(', ')}). No se escribe nada.`);
  }

  // 5. Simulación: lo que se retiraría, con código, membresía, usuario de Auth y nombre.
  const retire = [...selection.retire].sort((a, b) => String(a.participant_code).localeCompare(String(b.participant_code)));
  console.log(`Evento ${TRAINING_EVENT.slug}: ${memberships.length} membresías activas.`);
  console.log(`Se conservan ${selection.keep.length} cuentas: ${KEEP_CODES.join(', ')}`);
  console.log(`Inesperadas (no se tocan): ${selection.unexpected.length}`);
  console.log(`Se retirarían ${retire.length} cuentas:`);
  for (const membership of retire) {
    const user = usersById.get(membership.user_id as string);
    const name = nameOf.get(membership.participant_code as string);
    console.log(
      [
        membership.participant_code,
        `membresía=${membership.id}`,
        `auth=${user?.supabase_auth_user_id ?? '(sin acceso)'}`,
        name ? `${name.firstName} ${name.lastName}` : '(sin nombre)',
      ].join('\t'),
    );
  }

  if (apply) {
    const now = new Date().toISOString();
    let accessRemoved = 0;

    for (const membership of retire) {
      const code = membership.participant_code as string;
      const user = usersById.get(membership.user_id as string);

      // Primero el acceso en Auth; si falla, no se toca nada de esta cuenta y se puede reintentar.
      if (user?.supabase_auth_user_id) {
        const removed = (await db.auth.admin.deleteUser(user.supabase_auth_user_id as string)) as { error: any };
        if (removed.error) fail(`No se pudo borrar el acceso de ${code}: ${removed.error.message}. Se detiene; reintentar es seguro.`);
        const unlinked = (await db.from('users').update({ supabase_auth_user_id: null, email: null, updated_at: now }).eq('id', membership.user_id)) as { error: any };
        check(unlinked, `usuario de ${code}`);
        accessRemoved += 1;
      }

      // Luego el borrado lógico de la membresía, solo si sigue activa.
      const retired = (await db
        .from('event_memberships')
        .update({ deleted_at: now, status_changed_at: now })
        .eq('id', membership.id)
        .eq('event_id', eventId)
        .is('deleted_at', null)
        .select('id')) as { data: Row[] | null; error: any };
      check(retired, `membresía de ${code}`);
      if (!retired.data || retired.data.length !== 1) fail(`La membresía de ${code} no se pudo retirar (no quedó una fila)`);
    }

    console.log(JSON.stringify({ modo: 'aplicado', membresiasRetiradas: retire.length, accesosBorrados: accessRemoved }, null, 2));
  } else {
    console.log('Simulación: no se escribió nada. Usa --apply para retirar (requiere autorización de la persona dueña).');
  }

  // 6. Listado de credenciales con las 12 que quedan. Solo archivo local; no toca la base.
  if (credentials) {
    const secret = readSecret();
    const rows: RosterRow[] = roster
      .filter((account) => KEEP_CODES.includes(account.code))
      .map((account) => {
        const membership = selection.keep.find((m) => m.participant_code === account.code);
        return rosterRowOf(account, secret, (membership?.delegation_code as string | null | undefined) ?? null);
      });
    if (rows.length !== 12) fail(`El listado debe tener 12 cuentas y tiene ${rows.length}`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify({ evento: TRAINING_EVENT.name, generado: new Date().toISOString(), cuentas: rows }, null, 2));
    console.log(`Listado de credenciales (12 cuentas) escrito en ${out}`);
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Falló la reducción del evento de entrenamiento:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
