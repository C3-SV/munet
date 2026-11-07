import bcrypt from 'bcrypt';
import { supabaseAdmin } from '../lib/supabase';
import { generateInitialPassword } from '../utils/password.utils';

// Alta completa de un participante: user + membership + profile + codigo #.
// La usan el alta individual (POST /admin/create-account) y la importacion
// CSV, para que ambas sigan exactamente las mismas reglas.
//
// Supabase no ofrece transacciones entre inserts del cliente, asi que si un
// paso falla se deshace a mano lo ya creado (perfil, membership, user) para
// no dejar cuentas a medias.

export type CreateParticipantAccountInput = {
  event_id: string;
  participant_code: string;
  role: string;
  committee_id?: string | null;
  delegation_name?: string | null;
  institution_name?: string | null;
  first_name: string;
  last_name: string;
  display_name?: string | null;
  bio?: string | null;
  alias?: string | null;
};

export type CreateParticipantAccountResult =
  | {
      ok: true;
      user: Record<string, unknown>;
      membership: Record<string, unknown> & { id: string };
      profile: Record<string, unknown> | null;
      initialPassword: string;
      delegationCode: string | null;
      warnings: string[];
    }
  | { ok: false; status: number; error: string };

type Committee = { id: string; event_id: string; status?: string | null };

const fail = (status: number, error: string): CreateParticipantAccountResult => ({ ok: false, status, error });

// Asigna el codigo # de delegacion con la funcion SQL de la migracion 002.
// Es atomica por evento (advisory lock) e idempotente. Si falla, la cuenta
// se conserva y se avisa: la funcion se puede volver a ejecutar despues.
export const assignDelegationCode = async (
  membershipId: string
): Promise<{ code: string | null; error: string | null }> => {
  const { data, error } = await supabaseAdmin.rpc('assign_delegation_code', {
    p_membership_id: membershipId,
  });
  if (error) return { code: null, error: error.message };
  return { code: typeof data === 'string' ? data : null, error: null };
};

const rollback = async (ids: { userId?: string; membershipId?: string }) => {
  if (ids.membershipId) {
    const { error } = await supabaseAdmin.from('event_memberships').delete().eq('id', ids.membershipId);
    if (error) console.error('Rollback: no se pudo borrar la membership', ids.membershipId, error.message);
  }
  if (ids.userId) {
    const { error } = await supabaseAdmin.from('users').delete().eq('id', ids.userId);
    if (error) console.error('Rollback: no se pudo borrar el user', ids.userId, error.message);
  }
};

export const createParticipantAccount = async (
  input: CreateParticipantAccountInput,
  actorUserId: string | null,
  options?: { committee?: Committee | null; skipCodeCheck?: boolean }
): Promise<CreateParticipantAccountResult> => {
  const {
    event_id,
    participant_code,
    role,
    committee_id,
    delegation_name,
    institution_name,
    first_name,
    last_name,
    display_name,
    bio,
    alias,
  } = input;

  // 1. Codigo de login unico en el evento. La importacion ya lo valido en
  //    lote y lo indica con skipCodeCheck para ahorrar una consulta por fila.
  if (!options?.skipCodeCheck) {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('event_memberships')
      .select('id')
      .eq('participant_code', participant_code)
      .eq('event_id', event_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingError) return fail(500, 'No se pudo validar el codigo de participante');
    if (existing) return fail(409, 'participant_code ya existe en este evento');
  }

  // 2. Comite: debe existir, ser del mismo evento y no estar archivado.
  if (committee_id) {
    let committee = options?.committee ?? null;
    if (!committee || committee.id !== committee_id) {
      const { data, error } = await supabaseAdmin
        .from('committees')
        .select('id, event_id, status')
        .eq('id', committee_id)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) return fail(500, 'No se pudo validar el comite');
      committee = data;
    }
    if (!committee) return fail(404, 'Comite no encontrado');
    if (committee.event_id !== event_id) return fail(400, 'El comite no pertenece al evento indicado');
    if (committee.status === 'ARCHIVED') return fail(400, 'El comite esta archivado');
  }

  // 3. Contrasena inicial generada por el servidor; solo se guarda el hash.
  //    Se calcula antes de insertar para no dejar un user huerfano si falla.
  const initialPassword = generateInitialPassword();
  const initialPasswordHash = await bcrypt.hash(initialPassword, 10);

  // 4. User vacio (la identidad real es la membership).
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .insert({ created_by_user_id: actorUserId, updated_by_user_id: actorUserId })
    .select()
    .single();

  if (userError || !user) return fail(500, 'Error creando user');

  // 5. Membership.
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('event_memberships')
    .insert({
      event_id,
      user_id: user.id,
      participant_code,
      role,
      committee_id: committee_id ?? null,
      delegation_name: delegation_name ?? null,
      institution_name: institution_name ?? null,
      account_status: 'PENDING_ACTIVATION',
      status_changed_at: new Date().toISOString(),
      initial_password_hash: initialPasswordHash,
      created_by_user_id: actorUserId,
      updated_by_user_id: actorUserId,
    })
    .select()
    .single();

  if (membershipError || !membership) {
    await rollback({ userId: user.id });
    // 23505 = otra alta tomo el mismo participant_code al mismo tiempo.
    if (membershipError?.code === '23505') return fail(409, 'participant_code ya existe en este evento');
    return fail(400, membershipError?.message || 'Error creando membership');
  }

  // 6. Perfil.
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({
      event_membership_id: membership.id,
      first_name,
      last_name,
      display_name: display_name ?? null,
      bio: bio ?? null,
      alias: alias ?? null,
      profile_image_path: null,
      updated_by_membership_id: membership.id,
    })
    .select()
    .single();

  if (profileError) {
    await rollback({ userId: user.id, membershipId: membership.id });
    return fail(400, profileError.message);
  }

  // 7. Codigo # de delegacion (S2-03). Se asigna al final para no gastar
  //    numeros en altas que despues se deshacen.
  const warnings: string[] = [];
  const { code: delegationCode, error: codeError } = await assignDelegationCode(membership.id);
  if (codeError) {
    console.error('No se pudo asignar el codigo de delegacion', membership.id, codeError);
    warnings.push('La cuenta se creo pero no se pudo asignar el codigo #. Se puede reintentar despues.');
  }

  return {
    ok: true,
    user,
    membership: { ...membership, delegation_code: delegationCode },
    profile,
    initialPassword,
    delegationCode,
    warnings,
  };
};