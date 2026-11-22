const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { loadTs } = require('../test-helpers/load-ts.cjs');
const { memoryDb } = require('../test-helpers/memory-db.cjs');

const data = loadTs(__dirname + '/training-event.data.ts', { 'node:crypto': require('node:crypto') }, { Error });
const SECRET = 'secreto-de-prueba-0123456789';
const fixtures = loadTs(__dirname + '/training-event.fixtures.ts', { 'node:zlib': require('node:zlib') }, { Buffer, Math });
const utils = loadTs(__dirname + '/../utils/attachments.utils.ts');
const seed = loadTs(__dirname + '/training-event.seed.ts', {
  'node:crypto': { randomUUID },
  './training-event.data': data,
  './training-event.fixtures': fixtures,
}, { Buffer, Math, Date, Map, Set, Error });

const quiet = () => {};
const plain = (value) => JSON.parse(JSON.stringify(value));

function setup({ initial = {}, withStorage = true, uploadOk = true, failCodes = [] } = {}) {
  const db = memoryDb(initial);
  const auth = { users: new Map(), created: [], updated: [], deleted: [] };
  let authCounter = 0;
  db.auth = {
    admin: {
      async createUser(input) { const id = `auth-${++authCounter}`; auth.users.set(id, input); auth.created.push(input.email); return { data: { user: { id } }, error: null }; },
      async updateUserById(id, input) { auth.updated.push([id, input.password]); return { data: null, error: null }; },
      async deleteUser(id) { auth.users.delete(id); auth.deleted.push(id); return { data: null, error: null }; },
    },
  };

  const storageCalls = { presigned: [], deleted: [], listed: [] };
  const objects = new Set();
  const storage = withStorage ? {
    async presignUpload(params) { storageCalls.presigned.push(params); return { url: `https://r2.test/${params.key}`, headers: { 'Content-Type': params.contentType } }; },
    async list({ prefix }) { storageCalls.listed.push(prefix); return { objects: [...objects].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), nextToken: null }; },
    async delete(key) { storageCalls.deleted.push(key); objects.delete(key); },
  } : null;
  const uploads = [];

  // Alta falsa: crea user + membresía pendiente + perfil, como el servicio real.
  const createAccount = async (input, _actor, options) => {
    if (failCodes.includes(input.participant_code)) return { ok: false, status: 409, error: 'código en uso' };
    const user = { id: randomUUID() };
    db.rowsOf('users').push(user);
    const membership = {
      id: randomUUID(), event_id: input.event_id, user_id: user.id, participant_code: input.participant_code, role: input.role,
      committee_id: input.committee_id ?? null, account_status: 'PENDING_ACTIVATION', delegation_code: `#${String(db.rowsOf('event_memberships').length + 1).padStart(3, '0')}`,
    };
    db.rowsOf('event_memberships').push(membership);
    return { ok: true, user, membership, profile: {}, initialPassword: 'aleatoria', delegationCode: membership.delegation_code, warnings: [] };
  };

  const deps = {
    db, createAccount, storage,
    hash: async (plain) => `hash(${plain})`,
    upload: async (url, headers, body) => {
      uploads.push({ url, headers: { ...headers }, body });
      if (uploadOk) objects.add(url.replace('https://r2.test/', ''));
      return uploadOk;
    },
    now: () => new Date('2026-11-21T12:00:00Z'),
    log: quiet,
    secret: SECRET,
  };
  return { deps, db, auth, storageCalls, uploads, objects, run: (options) => seed.runTrainingSeed(deps, { apply: true, reset: false, ...options }) };
}

const table = (h, name) => h.db.rowsOf(name);
const eventOf = (h) => table(h, 'events')[0];
const writes = (h) => h.db.log.filter((entry) => entry.op !== 'select');

// ---------------------------------------------------------------------------------------------

test('simulación sin evento: cuenta lo que haría y no escribe nada', async () => {
  const h = setup();
  const report = await h.run({ apply: false });

  assert.equal(report.dryRun, true);
  assert.equal(report.event, 'por-crear');
  assert.equal(report.committees.created, 4);
  assert.equal(report.accounts.created, 12);
  assert.equal(writes(h).length, 0);
  assert.equal(h.auth.created.length, 0);
  assert.equal(h.uploads.length, 0);
});

test('siembra completa: evento, muros, comités, 12 cuentas y contenido', async () => {
  const h = setup();
  const report = await h.run();

  assert.equal(report.event, 'creado');
  const event = eventOf(h);
  assert.equal(event.name, 'Conoce MUNET');
  assert.equal(event.slug, 'conoce-munet');
  assert.equal(event.status, 'ACTIVE');
  assert.equal(event.is_read_only, false);

  const walls = table(h, 'walls');
  assert.equal(walls.filter((w) => w.wall_type === 'GENERAL').length, 1);
  assert.equal(walls.filter((w) => w.wall_type === 'ANNOUNCEMENTS').length, 1);
  assert.equal(walls.filter((w) => w.wall_type === 'COMMITTEE').length, 4);
  assert.ok(walls.every((w) => w.event_id === event.id));
  assert.equal(table(h, 'committees').length, 4);

  const members = table(h, 'event_memberships');
  assert.equal(members.length, 12);
  const status = (s) => members.filter((m) => m.account_status === s).length;
  assert.deepEqual([status('ACTIVE'), status('PENDING_ACTIVATION'), status('SUSPENDED')], [9, 2, 1]);
  assert.equal(report.accounts.created, 12);
  assert.equal(report.roster.length, 12);
});

test('cuentas activas y suspendidas tienen acceso con contraseña conocida; las pendientes no', async () => {
  const h = setup();
  await h.run();
  const members = table(h, 'event_memberships');
  const users = table(h, 'users');
  const byCode = Object.fromEntries(members.map((m) => [m.participant_code, m]));
  const userOf = (code) => users.find((u) => u.id === byCode[code].user_id);

  // 9 activas (staff y CON-001 a CON-006) + 1 suspendida = 10 usuarios de acceso
  assert.equal(h.auth.created.length, 10);
  assert.ok(h.auth.created.includes('con-001@munet.local'));
  assert.equal([...h.auth.users.values()].find((u) => u.email === 'con-001@munet.local').password, data.knownPassword('CON-001', SECRET));
  assert.ok(userOf('CON-001').supabase_auth_user_id);
  assert.equal(byCode['CON-001'].initial_password_hash, null);
  assert.ok(byCode['CON-001'].activated_at);

  // pendientes: contraseña inicial individual, sin usuario de acceso
  assert.equal(byCode['CON-023'].account_status, 'PENDING_ACTIVATION');
  assert.equal(byCode['CON-023'].initial_password_hash, `hash(${data.initialPassword('CON-023', SECRET)})`);
  assert.equal(userOf('CON-023').supabase_auth_user_id, undefined);

  // suspendidas: activadas y luego suspendidas
  assert.equal(byCode['CON-033'].account_status, 'SUSPENDED');
  assert.ok(userOf('CON-033').supabase_auth_user_id);
});

test('contenido sembrado: publicaciones, fijados, encuesta con votos, comentarios y DM', async () => {
  const h = setup();
  const report = await h.run();
  assert.deepEqual(plain(report.counts), {
    posts: data.TRAINING_POSTS.length, comments: data.TRAINING_COMMENTS.length, votes: data.TRAINING_POLL.votes.length,
    conversations: data.TRAINING_DMS.length, messages: data.TRAINING_DMS.reduce((n, d) => n + d.messages.length, 0), attachments: 2,
  });

  const posts = table(h, 'posts');
  assert.equal(posts.length, data.TRAINING_POSTS.length);
  assert.ok(posts.every((p) => p.event_id === eventOf(h).id && p.status === 'VISIBLE'));
  assert.equal(posts.filter((p) => p.is_pinned).length, 2);
  assert.ok(posts.filter((p) => p.is_pinned).every((p) => p.pinned_at && p.pinned_by_membership_id));
  assert.equal(posts.filter((p) => p.post_type === 'POLL').length, 1);

  // avisos solo de la organización
  const wallById = Object.fromEntries(table(h, 'walls').map((w) => [w.id, w]));
  const memberById = Object.fromEntries(table(h, 'event_memberships').map((m) => [m.id, m]));
  for (const post of posts) {
    if (wallById[post.wall_id].wall_type === 'ANNOUNCEMENTS') assert.ok(['ADMIN_MUN', 'MODERATOR'].includes(memberById[post.author_membership_id].role));
  }

  assert.equal(table(h, 'polls').length, 1);
  assert.equal(table(h, 'poll_options').length, 4);
  assert.equal(table(h, 'poll_votes').length, data.TRAINING_POLL.votes.length);
  assert.equal(new Set(table(h, 'poll_votes').map((v) => v.voter_membership_id)).size, data.TRAINING_POLL.votes.length);
  assert.equal(table(h, 'post_comments').length, data.TRAINING_COMMENTS.length);
  assert.equal(table(h, 'post_comments').filter((c) => c.parent_comment_id).length, 2);
  assert.equal(table(h, 'dm_conversations').length, 2);
  assert.equal(table(h, 'dm_messages').length, 5);
});

test('las fechas del contenido son pasadas y ordenadas respecto de ahora', async () => {
  const h = setup();
  await h.run();
  const now = new Date('2026-11-21T12:00:00Z').getTime();
  for (const post of table(h, 'posts')) assert.ok(new Date(post.created_at).getTime() < now, post.content.slice(0, 30));
  const bienvenida = table(h, 'posts').find((p) => p.content.startsWith('¡Bienvenidas'));
  const encuesta = table(h, 'posts').find((p) => p.post_type === 'POLL');
  assert.ok(new Date(bienvenida.created_at) < new Date(encuesta.created_at));
});

test('adjuntos: un PDF y un PNG válidos, uno por publicación, subidos con tipo y tamaño firmados', async () => {
  const h = setup();
  await h.run();
  const attachments = table(h, 'attachments');
  assert.equal(attachments.length, 2);
  assert.equal(new Set(attachments.map((a) => a.post_id)).size, 2);
  assert.deepEqual(attachments.map((a) => a.mime_type).sort(), ['application/pdf', 'image/png']);

  for (const a of attachments) {
    assert.match(a.storage_path, new RegExp(`^events/${eventOf(h).id}/posts/[0-9a-f-]{36}\\.(png|pdf)$`));
    assert.ok(a.size_bytes > 0 && a.size_bytes <= (a.mime_type === 'image/png' ? 5 : 20) * 1024 * 1024);
  }
  for (const upload of h.uploads) {
    assert.equal(utils.detectAttachmentMime(new Uint8Array(upload.body.subarray(0, 8))), upload.headers['Content-Type']);
  }
  for (const params of h.storageCalls.presigned) assert.ok(params.contentLength > 0 && params.expiresInSeconds > 0);
});

test('sin almacenamiento configurado se omiten los adjuntos con un aviso, sin fallar', async () => {
  const h = setup({ withStorage: false });
  const report = await h.run();
  assert.equal(report.counts.attachments, 0);
  assert.equal(table(h, 'attachments').length, 0);
  assert.ok(report.warnings.some((w) => /almacenamiento/.test(w)));
  assert.equal(report.counts.posts, data.TRAINING_POSTS.length);
});

test('si falla la subida de un archivo se omite ese adjunto y se avisa', async () => {
  const h = setup({ uploadOk: false });
  const report = await h.run();
  assert.equal(report.counts.attachments, 0);
  assert.equal(report.warnings.filter((w) => /No se pudo subir/.test(w)).length, 2);
});

test('repetir la siembra es idempotente: no duplica nada', async () => {
  const h = setup();
  await h.run();
  const before = Object.fromEntries(['events', 'walls', 'committees', 'event_memberships', 'users', 'posts', 'post_comments', 'poll_votes', 'dm_messages', 'attachments'].map((t) => [t, table(h, t).length]));
  h.db.log.length = 0;
  h.auth.created.length = 0;

  const report = await h.run();
  const after = Object.fromEntries(Object.keys(before).map((t) => [t, table(h, t).length]));
  assert.deepEqual(after, before);
  assert.equal(report.event, 'existente');
  assert.equal(report.accounts.created, 0);
  assert.equal(report.accounts.existing, 12);
  assert.equal(report.content, 'omitido-ya-existe');
  assert.equal(h.auth.created.length, 0);
  assert.equal(h.db.log.some((e) => e.op === 'insert'), false);
});

test('un evento existente sin cuentas ni contenido se completa sin tocar el evento', async () => {
  const eventId = randomUUID();
  const h = setup({ initial: { events: [{ id: eventId, name: 'Conoce MUNET', slug: 'conoce-munet', status: 'ACTIVE' }] } });
  const report = await h.run();
  assert.equal(report.event, 'existente');
  assert.equal(table(h, 'events').length, 1);
  assert.equal(table(h, 'event_memberships').length, 12);
  assert.ok(table(h, 'event_memberships').every((m) => m.event_id === eventId));
});

test('simulación con evento existente informa lo que ya hay', async () => {
  const h = setup();
  await h.run();
  h.db.log.length = 0;
  const report = await h.run({ apply: false });
  assert.equal(report.dryRun, true);
  assert.equal(report.accounts.existing, 12);
  assert.equal(report.accounts.created, 0);
  assert.equal(report.committees.created, 0);
  assert.equal(report.content, 'omitido-ya-existe');
  assert.equal(writes(h).length, 0);
});

// ---------------------------------------------------------------------------------------------
// Reinicio

test('reiniciar borra el contenido, limpia R2 y devuelve las cuentas a su estado inicial', async () => {
  const h = setup();
  await h.run();
  const members = table(h, 'event_memberships');
  const byCode = Object.fromEntries(members.map((m) => [m.participant_code, m]));
  const users = table(h, 'users');

  // Estado "gastado" tras un entrenamiento: una pendiente se activó, una activa se suspendió,
  // una suspendida se reactivó y alguien publicó algo.
  const pending = byCode['CON-023'];
  pending.account_status = 'ACTIVE';
  pending.initial_password_hash = null;
  users.find((u) => u.id === pending.user_id).supabase_auth_user_id = 'auth-gastado';
  h.auth.users.set('auth-gastado', { email: 'con-023@munet.local', password: 'ElUsuarioLaCambio1' });
  byCode['CON-001'].account_status = 'SUSPENDED';
  byCode['CON-033'].account_status = 'ACTIVE';
  table(h, 'posts').push({ id: 'extra', event_id: eventOf(h).id, content: 'basura de entrenamiento' });
  const postsBefore = data.TRAINING_POSTS.length;

  h.auth.deleted.length = 0;
  h.auth.updated.length = 0;
  const report = await h.run({ reset: true });

  // contenido: se borró y se volvió a sembrar, sin la publicación extra
  assert.equal(table(h, 'posts').length, postsBefore);
  assert.equal(table(h, 'posts').some((p) => p.id === 'extra'), false);
  assert.equal(report.content, 'sembrado');
  assert.equal(table(h, 'attachments').length, 2);
  assert.deepEqual(plain(h.storageCalls.listed.slice(-2)), [`events/${eventOf(h).id}/`, `pending/${eventOf(h).id}/`]);
  assert.equal(h.storageCalls.deleted.length, 2, 'se borraron los dos archivos anteriores de R2');

  // cuentas: vuelven a su estado
  const after = Object.fromEntries(table(h, 'event_memberships').map((m) => [m.participant_code, m]));
  assert.equal(after['CON-023'].account_status, 'PENDING_ACTIVATION');
  assert.equal(after['CON-023'].initial_password_hash, `hash(${data.initialPassword('CON-023', SECRET)})`);
  assert.equal(after['CON-023'].activated_at, null);
  assert.ok(h.auth.deleted.includes('auth-gastado'), 'se borró el usuario de acceso de la cuenta que se había activado');
  assert.equal(users.find((u) => u.id === pending.user_id).supabase_auth_user_id, null);
  assert.equal(after['CON-001'].account_status, 'ACTIVE');
  assert.equal(after['CON-033'].account_status, 'SUSPENDED');
  // las contraseñas de las cuentas con acceso se fijan de nuevo
  assert.ok(h.auth.updated.some(([, password]) => password === data.knownPassword('CON-001', SECRET)));
  assert.equal(table(h, 'event_memberships').length, 12);
});

test('reiniciar sin evento de entrenamiento falla sin escribir', async () => {
  const h = setup();
  await assert.rejects(h.run({ reset: true }), /No hay evento de entrenamiento/);
  assert.equal(writes(h).length, 0);
});

test('nunca escribe ni borra en un evento con el mismo slug pero otro nombre', async () => {
  const h = setup({ initial: { events: [{ id: randomUUID(), name: 'Evento oficial', slug: 'conoce-munet', status: 'ACTIVE' }] } });
  for (const options of [{}, { reset: true }, { apply: false }]) {
    await assert.rejects(h.run(options), /no es el de entrenamiento/);
  }
  assert.equal(writes(h).length, 0);
  assert.equal(h.storageCalls.deleted.length, 0);
});

test('el reinicio solo borra contenido del evento de entrenamiento, no el de otros eventos', async () => {
  const otherEvent = randomUUID();
  const h = setup({ initial: {
    posts: [{ id: 'oficial', event_id: otherEvent, content: 'post oficial' }],
    post_comments: [{ id: 'c-oficial', event_id: otherEvent, content: 'comentario oficial' }],
    dm_messages: [{ id: 'm-oficial', event_id: otherEvent, content: 'dm oficial' }],
    attachments: [{ id: 'a-oficial', event_id: otherEvent }],
  } });
  await h.run();
  await h.run({ reset: true });
  assert.ok(table(h, 'posts').some((p) => p.id === 'oficial'));
  assert.ok(table(h, 'post_comments').some((c) => c.id === 'c-oficial'));
  assert.ok(table(h, 'dm_messages').some((m) => m.id === 'm-oficial'));
  assert.ok(table(h, 'attachments').some((a) => a.id === 'a-oficial'));
});

// ---------------------------------------------------------------------------------------------

test('cuenta propia: se vincula como ADMIN_MUN con el mismo usuario y es idempotente', async () => {
  const ownerUser = randomUUID();
  const demoEvent = randomUUID();
  const h = setup({ initial: { event_memberships: [{ id: randomUUID(), event_id: demoEvent, user_id: ownerUser, participant_code: 'adminMUN', role: 'ADMIN_MUN', account_status: 'ACTIVE' }] } });

  const first = await h.run({ ownerCode: 'adminMUN' });
  assert.equal(first.owner, 'vinculado');
  const linked = table(h, 'event_memberships').find((m) => m.participant_code === 'adminMUN' && m.event_id === eventOf(h).id);
  assert.equal(linked.user_id, ownerUser, 'misma persona');
  assert.equal(linked.role, 'ADMIN_MUN');
  assert.equal(linked.account_status, 'ACTIVE');

  const second = await h.run({ ownerCode: 'adminMUN' });
  assert.equal(second.owner, 'ya-vinculado');
  assert.equal(table(h, 'event_memberships').filter((m) => m.participant_code === 'adminMUN').length, 2);
});

test('cuenta propia inexistente: aviso y la siembra continúa', async () => {
  const h = setup();
  const report = await h.run({ ownerCode: 'nadie' });
  assert.equal(report.owner, 'no-encontrado');
  assert.ok(report.warnings.some((w) => /nadie/.test(w)));
  assert.equal(table(h, 'event_memberships').length, 12);
});

test('si una cuenta no se puede crear la siembra falla con el detalle y no siembra contenido', async () => {
  const h = setup({ failCodes: ['CON-002'] });
  await assert.rejects(h.run(), /CON-002 \(código en uso\)/);
  assert.equal(table(h, 'posts').length, 0);
});

test('el listado de salida lleva la contraseña correcta de cada estado y el código de delegación', async () => {
  const h = setup();
  const report = await h.run();
  const row = (code) => report.roster.find((r) => r.code === code);
  assert.equal(row('CON-001').password, data.knownPassword('CON-001', SECRET));
  assert.equal(row('CON-023').password, data.initialPassword('CON-023', SECRET));
  assert.equal(row('CON-033').password, data.knownPassword('CON-033', SECRET));
  assert.equal(row('CON-001').state, 'ACTIVE');
  assert.equal(row('CON-023').state, 'PENDING');
  assert.equal(row('CON-033').state, 'SUSPENDED');
  assert.match(row('CON-001').delegationCode, /^#\d{3}$/);
  assert.equal(row('CON-ADM').role, 'ADMIN_MUN');
  assert.equal(row('CON-001').committee, 'Asamblea General');
});

// ---------------------------------------------------------------------------------------------
// Archivos de ejemplo

test('el PNG de ejemplo es válido, liviano y se reconoce como imagen', () => {
  const png = fixtures.makePng();
  assert.equal(utils.detectAttachmentMime(new Uint8Array(png.subarray(0, 8))), 'image/png');
  assert.ok(png.length > 100 && png.length < 5 * 1024 * 1024);
  assert.equal(png.readUInt32BE(16), 480);
  assert.equal(png.readUInt32BE(20), 240);
  assert.equal(png.subarray(png.length - 8, png.length - 4).toString('ascii'), 'IEND');
});

test('el PDF de ejemplo es válido, liviano y se reconoce como PDF', () => {
  const pdf = fixtures.makePdf();
  assert.equal(utils.detectAttachmentMime(new Uint8Array(pdf.subarray(0, 8))), 'application/pdf');
  const text = pdf.toString('latin1');
  assert.match(text, /%%EOF\n$/);
  assert.match(text, /startxref\n\d+\n%%EOF/);
  assert.ok(pdf.length < 20 * 1024);
  const xref = Number(text.match(/startxref\n(\d+)/)[1]);
  assert.equal(text.slice(xref, xref + 4), 'xref');
});
