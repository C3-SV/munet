import { randomUUID } from 'node:crypto';
import type {
  CreateParticipantAccountInput,
  CreateParticipantAccountResult,
} from '../services/participant-account.service';
import {
  INSTITUTION,
  TRAINING_ATTACHMENTS,
  TRAINING_COMMENTS,
  TRAINING_COMMITTEES,
  TRAINING_DMS,
  TRAINING_EVENT,
  TRAINING_POLL,
  TRAINING_POSTS,
  buildRoster,
  initialPassword,
  knownPassword,
  passwordFor,
  type SeedAccount,
  type SeedState,
} from './training-event.data';
import { MIME_BY_KIND, makePdf, makePng } from './training-event.fixtures';

// Siembra, repite y reinicia el evento «Conoce MUNET». Con apply=false solo lee y cuenta lo que
// haría. Con apply=true es idempotente: lo que ya existe se conserva. Con reset=true borra primero
// el contenido del evento (nunca el de otro) y devuelve las cuentas a su estado inicial.

type Row = Record<string, any>;
type Result<T = any> = { data?: T; error?: { message: string } | null; count?: number | null };

export type SeedDb = {
  from(table: string): any;
  auth: {
    admin: {
      createUser(input: { email: string; password: string; email_confirm: boolean }): Promise<Result<{ user: { id: string } }>>;
      updateUserById(id: string, input: { password: string }): Promise<Result>;
      deleteUser(id: string): Promise<Result>;
    };
  };
};

export type SeedStorage = {
  presignUpload(params: { key: string; contentType: string; contentLength: number; expiresInSeconds: number }): Promise<{ url: string; headers: Record<string, string> }>;
  list(params: { prefix: string; continuationToken?: string }): Promise<{ objects: { key: string }[]; nextToken: string | null }>;
  delete(key: string): Promise<void>;
};

export type SeedDeps = {
  db: SeedDb;
  createAccount: (
    input: CreateParticipantAccountInput,
    actorUserId: string | null,
    options?: { committee?: { id: string; event_id: string; status?: string | null } | null }
  ) => Promise<CreateParticipantAccountResult>;
  hash: (plain: string) => Promise<string>;
  storage: SeedStorage | null;
  upload: (url: string, headers: Record<string, string>, body: Uint8Array) => Promise<boolean>;
  now: () => Date;
  log: (message: string) => void;
  // Secreto local del que se derivan las contraseñas (ver training-event.data.ts).
  secret: string;
};

// `ownerCode`: código de ingreso de la cuenta real de quien administra la plataforma. Si existe en
// otro evento, esa misma persona recibe una membresía de administración aquí para ver el evento
// y su panel (un código puede repetirse entre eventos solo si es la misma persona).
export type SeedOptions = { apply: boolean; reset: boolean; ownerCode?: string };

export type RosterRow = {
  code: string;
  password: string;
  role: string;
  state: SeedState;
  name: string;
  committee: string | null;
  delegation: string | null;
  delegationCode: string | null;
};

export type SeedReport = {
  owner: 'vinculado' | 'ya-vinculado' | 'no-encontrado' | 'sin-solicitar' | 'por-vincular';
  dryRun: boolean;
  reset: boolean;
  event: 'creado' | 'existente' | 'por-crear';
  committees: { created: number; existing: number };
  accounts: { created: number; existing: number; failed: { code: string; error: string }[] };
  content: 'sembrado' | 'omitido-ya-existe' | 'por-sembrar';
  counts: { posts: number; comments: number; votes: number; conversations: number; messages: number; attachments: number };
  warnings: string[];
  roster: RosterRow[];
};

const fail = (what: string, error?: { message: string } | null): never => {
  throw new Error(`${what}: ${error?.message ?? 'sin detalle'}`);
};
const ok = <T = any>(result: Result, what: string): T => {
  if (result.error) fail(what, result.error);
  return result.data as T;
};

const hoursBefore = (now: Date, hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();
const emailOf = (code: string) => `${code.toLowerCase()}@munet.local`;
const isoDate = (date: Date) => date.toISOString().slice(0, 10);

// ---------------------------------------------------------------------------------------------

const findEvent = async (db: SeedDb): Promise<Row | null> =>
  ok(
    await db.from('events').select('id, name, slug, status').eq('slug', TRAINING_EVENT.slug).is('deleted_at', null).maybeSingle(),
    'No se pudo consultar el evento',
  ) ?? null;

// Defensa contra borrar o escribir en otro evento: el slug lo encontró, pero el nombre debe coincidir.
const assertTrainingEvent = (event: Row) => {
  if (event.slug !== TRAINING_EVENT.slug || event.name !== TRAINING_EVENT.name) {
    throw new Error(`El evento con slug ${TRAINING_EVENT.slug} no es el de entrenamiento (nombre: ${event.name}). No se toca.`);
  }
};

const loadMemberships = async (db: SeedDb, eventId: string): Promise<Map<string, Row>> => {
  const rows = ok<Row[]>(
    await db.from('event_memberships').select('id, user_id, participant_code, account_status, role, delegation_code').eq('event_id', eventId).is('deleted_at', null),
    'No se pudieron consultar las membresías',
  ) ?? [];
  return new Map(rows.map((row) => [row.participant_code, row]));
};

const loadUsers = async (db: SeedDb, ids: string[]): Promise<Map<string, Row>> => {
  if (ids.length === 0) return new Map();
  const rows = ok<Row[]>(await db.from('users').select('id, supabase_auth_user_id, email').in('id', ids), 'No se pudieron consultar los usuarios') ?? [];
  return new Map(rows.map((row) => [row.id, row]));
};

// ---------------------------------------------------------------------------------------------
// Cuentas

// Deja la cuenta activada con una contraseña conocida (como lo haría el flujo de activación).
const activate = async (deps: SeedDeps, account: SeedAccount, membership: Row, user: Row | undefined) => {
  const { db } = deps;
  const password = knownPassword(account.code, deps.secret);
  let authId: string | null = user?.supabase_auth_user_id ?? null;

  if (authId) {
    ok(await db.auth.admin.updateUserById(authId, { password }), `No se pudo fijar la contraseña de ${account.code}`);
  } else {
    const created = ok(
      await db.auth.admin.createUser({ email: emailOf(account.code), password, email_confirm: true }),
      `No se pudo crear el usuario de acceso de ${account.code}`,
    );
    authId = created.user.id;
  }

  ok(await db.from('users').update({ supabase_auth_user_id: authId, email: emailOf(account.code), updated_at: deps.now().toISOString() }).eq('id', membership.user_id), `users de ${account.code}`);
  ok(
    await db.from('event_memberships').update({
      account_status: 'ACTIVE',
      activated_at: deps.now().toISOString(),
      status_changed_at: deps.now().toISOString(),
      initial_password_hash: null,
    }).eq('id', membership.id),
    `membresía de ${account.code}`,
  );
};

const suspend = async (deps: SeedDeps, account: SeedAccount, membership: Row) => {
  ok(
    await deps.db.from('event_memberships').update({ account_status: 'SUSPENDED', status_changed_at: deps.now().toISOString() }).eq('id', membership.id),
    `suspensión de ${account.code}`,
  );
};

// Deja la cuenta pendiente, con su contraseña inicial individual, y sin usuario de acceso.
const makePending = async (deps: SeedDeps, account: SeedAccount, membership: Row, user: Row | undefined) => {
  const { db } = deps;

  if (user?.supabase_auth_user_id) {
    ok(await db.auth.admin.deleteUser(user.supabase_auth_user_id), `No se pudo borrar el usuario de acceso de ${account.code}`);
    ok(await db.from('users').update({ supabase_auth_user_id: null, email: null }).eq('id', membership.user_id), `users de ${account.code}`);
  }

  ok(
    await db.from('event_memberships').update({
      account_status: 'PENDING_ACTIVATION',
      activated_at: null,
      last_login_at: null,
      status_changed_at: deps.now().toISOString(),
      initial_password_hash: await deps.hash(initialPassword(account.code, deps.secret)),
    }).eq('id', membership.id),
    `membresía de ${account.code}`,
  );
};

const applyState = async (deps: SeedDeps, account: SeedAccount, membership: Row, user: Row | undefined) => {
  if (account.state === 'PENDING') return makePending(deps, account, membership, user);
  await activate(deps, account, membership, user);
  if (account.state === 'SUSPENDED') await suspend(deps, account, membership);
};

const statusMatches = (account: SeedAccount, membership: Row) =>
  (account.state === 'PENDING' && membership.account_status === 'PENDING_ACTIVATION') ||
  (account.state === 'ACTIVE' && membership.account_status === 'ACTIVE') ||
  (account.state === 'SUSPENDED' && membership.account_status === 'SUSPENDED');

// ---------------------------------------------------------------------------------------------
// Contenido

const wipeContent = async (deps: SeedDeps, eventId: string, warnings: string[]) => {
  const { db } = deps;
  const polls = ok<Row[]>(await db.from('polls').select('id').eq('event_id', eventId), 'polls') ?? [];
  const pollIds = polls.map((p) => p.id);

  if (pollIds.length > 0) {
    ok(await db.from('poll_votes').delete().in('poll_id', pollIds), 'poll_votes');
    ok(await db.from('poll_options').delete().in('poll_id', pollIds), 'poll_options');
  }
  for (const table of ['polls', 'post_comments', 'attachments', 'attachment_uploads', 'posts', 'dm_messages', 'dm_conversations']) {
    ok(await db.from(table).delete().eq('event_id', eventId), `borrado de ${table}`);
  }

  if (!deps.storage) {
    warnings.push('Sin almacenamiento configurado: no se limpiaron archivos de R2.');
    return;
  }
  for (const prefix of [`events/${eventId}/`, `pending/${eventId}/`]) {
    let token: string | undefined;
    do {
      const page = await deps.storage.list({ prefix, continuationToken: token });
      for (const object of page.objects) await deps.storage.delete(object.key);
      token = page.nextToken ?? undefined;
    } while (token);
  }
};

type Counts = SeedReport['counts'];

const seedContent = async (deps: SeedDeps, eventId: string, members: Map<string, Row>, warnings: string[]): Promise<Counts> => {
  const { db } = deps;
  const counts: Counts = { posts: 0, comments: 0, votes: 0, conversations: 0, messages: 0, attachments: 0 };
  const now = deps.now();
  const idOf = (code: string) => {
    const member = members.get(code);
    if (!member) throw new Error(`Falta la cuenta ${code} para sembrar contenido`);
    return member.id as string;
  };

  const walls = ok<Row[]>(await db.from('walls').select('id, wall_type, committee_id').eq('event_id', eventId).is('deleted_at', null), 'muros') ?? [];
  const committees = ok<Row[]>(await db.from('committees').select('id, code').eq('event_id', eventId).is('deleted_at', null), 'comités') ?? [];
  const committeeIdByCode = new Map(committees.map((c) => [c.code, c.id]));
  const wallFor = (wall: (typeof TRAINING_POSTS)[number]['wall']) => {
    const found = typeof wall === 'object'
      ? walls.find((w) => w.wall_type === 'COMMITTEE' && w.committee_id === committeeIdByCode.get(wall.committee))
      : walls.find((w) => w.wall_type === wall);
    if (!found) throw new Error(`No existe el muro ${typeof wall === 'object' ? wall.committee : wall}`);
    return found.id as string;
  };

  const postIdByKey = new Map<string, string>();
  const adminId = idOf(`${TRAINING_EVENT.codePrefix}-ADM`);

  for (const post of TRAINING_POSTS) {
    const authorId = idOf(post.author);
    const createdAt = hoursBefore(now, post.hoursAgo);
    const isPoll = post.key === TRAINING_POLL.postKey;
    const inserted = ok(
      await db.from('posts').insert({
        event_id: eventId,
        wall_id: wallFor(post.wall),
        author_membership_id: authorId,
        created_by_membership_id: authorId,
        updated_by_membership_id: authorId,
        post_type: isPoll ? 'POLL' : 'TEXT',
        content: post.content,
        status: 'VISIBLE',
        created_at: createdAt,
        updated_at: createdAt,
        is_pinned: Boolean(post.pinned),
        pinned_at: post.pinned ? createdAt : null,
        pinned_by_membership_id: post.pinned ? adminId : null,
      }).select('id').single(),
      `publicación ${post.key}`,
    );
    postIdByKey.set(post.key, inserted.id);
    counts.posts += 1;
  }

  // Encuesta con sus votos.
  {
    const poll = ok(
      await db.from('polls').insert({
        event_id: eventId,
        wall_id: wallFor(TRAINING_POLL.wall),
        post_id: postIdByKey.get(TRAINING_POLL.postKey),
        author_membership_id: idOf(TRAINING_POLL.author),
        question: TRAINING_POLL.question,
        status: 'OPEN',
        created_at: hoursBefore(now, TRAINING_POLL.hoursAgo),
      }).select('id').single(),
      'encuesta',
    );
    const options = ok<Row[]>(
      await db.from('poll_options').insert(TRAINING_POLL.options.map((text, index) => ({ poll_id: poll.id, option_text: text, sort_order: index }))).select('id, sort_order'),
      'opciones de la encuesta',
    );
    const optionBySort = new Map(options.map((o) => [o.sort_order, o.id]));
    ok(
      await db.from('poll_votes').insert(TRAINING_POLL.votes.map((vote, index) => ({
        poll_id: poll.id,
        option_id: optionBySort.get(vote.option),
        voter_membership_id: idOf(vote.voter),
        voted_at: hoursBefore(now, Math.max(0.1, TRAINING_POLL.hoursAgo - 0.2 * (index + 1))),
      }))),
      'votos',
    );
    counts.votes = TRAINING_POLL.votes.length;
  }

  // Comentarios, en orden; `replyTo` es el índice dentro de los comentarios del mismo post.
  const idsByPost = new Map<string, string[]>();
  for (const comment of TRAINING_COMMENTS) {
    const authorId = idOf(comment.author);
    const siblings = idsByPost.get(comment.post) ?? [];
    const createdAt = hoursBefore(now, comment.hoursAgo);
    const inserted = ok(
      await db.from('post_comments').insert({
        event_id: eventId,
        post_id: postIdByKey.get(comment.post),
        author_membership_id: authorId,
        created_by_membership_id: authorId,
        updated_by_membership_id: authorId,
        parent_comment_id: comment.replyTo === undefined ? null : siblings[comment.replyTo] ?? null,
        content: comment.content,
        status: 'VISIBLE',
        created_at: createdAt,
        updated_at: createdAt,
      }).select('id').single(),
      'comentario',
    );
    siblings.push(inserted.id);
    idsByPost.set(comment.post, siblings);
    counts.comments += 1;
  }

  // Mensajes directos.
  for (const dm of TRAINING_DMS) {
    const start = hoursBefore(now, 5);
    const last = new Date(new Date(start).getTime() + Math.max(...dm.messages.map((m) => m.minutesAfterStart)) * 60_000).toISOString();
    const conversation = ok(
      await db.from('dm_conversations').insert({
        event_id: eventId,
        participant_a_membership_id: idOf(dm.a),
        participant_b_membership_id: idOf(dm.b),
        created_by_membership_id: idOf(dm.a),
        status: 'ACTIVE',
        created_at: start,
        last_message_at: last,
      }).select('id').single(),
      'conversación',
    );
    counts.conversations += 1;
    for (const message of dm.messages) {
      const at = new Date(new Date(start).getTime() + message.minutesAfterStart * 60_000).toISOString();
      const author = idOf(message.from === 'a' ? dm.a : dm.b);
      ok(
        await db.from('dm_messages').insert({
          event_id: eventId, conversation_id: conversation.id, author_membership_id: author,
          content: message.content, status: 'VISIBLE', created_at: at, updated_at: at,
        }),
        'mensaje directo',
      );
      counts.messages += 1;
    }
  }

  // Adjuntos de ejemplo.
  if (!deps.storage) {
    warnings.push('Sin almacenamiento configurado: se omitieron los adjuntos de ejemplo.');
    return counts;
  }
  for (const attachment of TRAINING_ATTACHMENTS) {
    const body = attachment.kind === 'png' ? makePng() : makePdf();
    const mime = MIME_BY_KIND[attachment.kind];
    const key = `events/${eventId}/posts/${randomUUID()}.${attachment.kind === 'png' ? 'png' : 'pdf'}`;
    const postId = postIdByKey.get(attachment.post)!;
    const author = TRAINING_POSTS.find((p) => p.key === attachment.post)!.author;
    const target = await deps.storage.presignUpload({ key, contentType: mime, contentLength: body.length, expiresInSeconds: 300 });
    if (!(await deps.upload(target.url, target.headers, body))) {
      warnings.push(`No se pudo subir ${attachment.fileName}; se omite el adjunto.`);
      continue;
    }
    ok(
      await db.from('attachments').insert({
        event_id: eventId, post_id: postId, uploaded_by_membership_id: idOf(author),
        storage_path: key, file_name: attachment.fileName, mime_type: mime, size_bytes: body.length,
      }),
      'adjunto',
    );
    counts.attachments += 1;
  }

  return counts;
};

// ---------------------------------------------------------------------------------------------

export const runTrainingSeed = async (deps: SeedDeps, options: SeedOptions): Promise<SeedReport> => {
  const { db, log } = deps;
  const roster = buildRoster();
  const report: SeedReport = {
    owner: options.ownerCode ? 'por-vincular' : 'sin-solicitar',
    dryRun: !options.apply,
    reset: options.reset,
    event: 'por-crear',
    committees: { created: 0, existing: 0 },
    accounts: { created: 0, existing: 0, failed: [] },
    content: 'por-sembrar',
    counts: { posts: 0, comments: 0, votes: 0, conversations: 0, messages: 0, attachments: 0 },
    warnings: [],
    roster: [],
  };

  let event = await findEvent(db);
  if (event) {
    assertTrainingEvent(event);
    report.event = 'existente';
  }
  if (options.reset && !event) throw new Error('No hay evento de entrenamiento que reiniciar.');

  // --- Simulación: solo contar.
  if (!options.apply) {
    if (!event) {
      report.committees.created = TRAINING_COMMITTEES.length;
      report.accounts.created = roster.length;
      return report;
    }
    const committees = ok<Row[]>(await db.from('committees').select('code').eq('event_id', event.id).is('deleted_at', null), 'comités') ?? [];
    report.committees.existing = committees.length;
    report.committees.created = TRAINING_COMMITTEES.filter((c) => !committees.some((x) => x.code === c.code)).length;
    const members = await loadMemberships(db, event.id);
    report.accounts.existing = roster.filter((a) => members.has(a.code)).length;
    report.accounts.created = roster.length - report.accounts.existing;
    const posts = ok<Row[]>(await db.from('posts').select('id').eq('event_id', event.id).limit(1), 'posts') ?? [];
    report.content = posts.length > 0 && !options.reset ? 'omitido-ya-existe' : 'por-sembrar';
    return report;
  }

  // --- Aplicar.
  const today = deps.now();
  if (!event) {
    const inserted = ok(
      await db.from('events').insert({
        name: TRAINING_EVENT.name,
        slug: TRAINING_EVENT.slug,
        description: TRAINING_EVENT.description,
        start_date: isoDate(today),
        end_date: isoDate(new Date(today.getTime() + 90 * 86_400_000)),
        status: 'ACTIVE',
        is_read_only: false,
      }).select('id, name, slug, status').single(),
      'No se pudo crear el evento',
    );
    event = inserted;
    report.event = 'creado';
    log(`Evento creado: ${TRAINING_EVENT.name}`);
  }
  const eventId = event!.id as string;

  const existingWalls = ok<Row[]>(await db.from('walls').select('id, wall_type, committee_id').eq('event_id', eventId).is('deleted_at', null), 'muros') ?? [];
  const wallRows = ['GENERAL', 'ANNOUNCEMENTS']
    .filter((type) => !existingWalls.some((w) => w.wall_type === type))
    .map((type) => ({ event_id: eventId, name: type === 'GENERAL' ? 'General' : 'Avisos', wall_type: type, committee_id: null, status: 'ACTIVE' }));
  if (wallRows.length > 0) ok(await db.from('walls').insert(wallRows), 'muros del evento');

  // Comités y su muro.
  const committeeRows = ok<Row[]>(await db.from('committees').select('id, code, event_id, status').eq('event_id', eventId).is('deleted_at', null), 'comités') ?? [];
  const committeeByCode = new Map(committeeRows.map((c) => [c.code, c]));
  for (const committee of TRAINING_COMMITTEES) {
    if (committeeByCode.has(committee.code)) { report.committees.existing += 1; continue; }
    const created = ok(
      await db.from('committees').insert({
        event_id: eventId, name: committee.name, code: committee.code, description: committee.description,
        sort_order: committee.sortOrder, status: 'ACTIVE',
      }).select('id, code, event_id, status').single(),
      `comité ${committee.code}`,
    );
    ok(await db.from('walls').insert({ event_id: eventId, name: committee.name, wall_type: 'COMMITTEE', committee_id: created.id, status: 'ACTIVE' }), `muro de ${committee.code}`);
    committeeByCode.set(committee.code, created);
    report.committees.created += 1;
  }

  // La cuenta real de quien administra: misma persona, membresía de administración en este evento.
  if (options.ownerCode) {
    const found = ok<Row[]>(
      await db.from('event_memberships').select('user_id, event_id').eq('participant_code', options.ownerCode).is('deleted_at', null),
      'cuenta de administración',
    ) ?? [];
    const own = found.find((row) => row.event_id !== eventId) ?? found[0];

    if (!own) {
      report.owner = 'no-encontrado';
      report.warnings.push(`No se encontró la cuenta ${options.ownerCode}: no se vinculó a este evento.`);
    } else if (found.some((row) => row.event_id === eventId)) {
      report.owner = 'ya-vinculado';
    } else {
      ok(
        await db.from('event_memberships').insert({
          event_id: eventId,
          user_id: own.user_id,
          participant_code: options.ownerCode,
          role: 'ADMIN_MUN',
          account_status: 'ACTIVE',
          status_changed_at: deps.now().toISOString(),
          activated_at: deps.now().toISOString(),
        }),
        'membresía de administración',
      );
      report.owner = 'vinculado';
    }
  }

  // Reinicio: contenido primero, luego cuentas.
  if (options.reset) {
    await wipeContent(deps, eventId, report.warnings);
    log('Contenido del evento borrado.');
  }

  // Cuentas.
  let members = await loadMemberships(db, eventId);
  const usersBefore = await loadUsers(db, [...members.values()].map((m) => m.user_id));

  for (const account of roster) {
    const current = members.get(account.code);

    if (!current) {
      const committee = account.committeeCode ? committeeByCode.get(account.committeeCode) : null;
      const created = await deps.createAccount(
        {
          event_id: eventId,
          participant_code: account.code,
          role: account.role,
          committee_id: committee?.id ?? null,
          delegation_name: account.delegation,
          institution_name: INSTITUTION,
          first_name: account.firstName,
          last_name: account.lastName,
          alias: account.alias,
        },
        null,
        { committee: (committee as { id: string; event_id: string; status?: string | null } | undefined) ?? null },
      );
      if (!created.ok) {
        report.accounts.failed.push({ code: account.code, error: created.error });
        continue;
      }
      const membership = { id: created.membership.id, user_id: (created.user as Row).id, account_status: 'PENDING_ACTIVATION' };
      await applyState(deps, account, membership, undefined);
      report.accounts.created += 1;
      continue;
    }

    report.accounts.existing += 1;
    if (options.reset || !statusMatches(account, current)) {
      await applyState(deps, account, current, usersBefore.get(current.user_id));
    }
  }
  if (report.accounts.failed.length > 0) {
    throw new Error(`Fallaron ${report.accounts.failed.length} cuentas: ${report.accounts.failed.map((f) => `${f.code} (${f.error})`).join('; ')}`);
  }

  members = await loadMemberships(db, eventId);

  // Contenido.
  const posts = ok<Row[]>(await db.from('posts').select('id').eq('event_id', eventId).limit(1), 'posts') ?? [];
  if (posts.length > 0) {
    report.content = 'omitido-ya-existe';
  } else {
    report.counts = await seedContent(deps, eventId, members, report.warnings);
    report.content = 'sembrado';
  }

  report.roster = roster.map((account) => ({
    code: account.code,
    password: passwordFor(account, deps.secret),
    role: account.role,
    state: account.state,
    name: `${account.firstName} ${account.lastName}`,
    committee: account.committeeCode ? TRAINING_COMMITTEES.find((c) => c.code === account.committeeCode)!.name : null,
    delegation: account.delegation,
    delegationCode: members.get(account.code)?.delegation_code ?? null,
  }));

  return report;
};
