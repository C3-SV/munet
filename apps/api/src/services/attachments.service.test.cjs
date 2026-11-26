const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('../test-helpers/load-ts.cjs');
const { fakeSupabase, hasStep } = require('../test-helpers/fake-supabase.cjs');

const types = loadTs(__dirname + '/../lib/storage/types.ts');
const utils = loadTs(__dirname + '/../utils/attachments.utils.ts');

const EVENT = '11111111-1111-4111-8111-111111111111';
const UPLOAD = '22222222-2222-4222-8222-222222222222';
const MEMBER = '33333333-3333-4333-8333-333333333333';
const WALL = '44444444-4444-4444-8444-444444444444';
const POST = '55555555-5555-4555-8555-555555555555';
const ATTACHMENT = '66666666-6666-4666-8666-666666666666';
const PENDING_KEY = `pending/${EVENT}/${UPLOAD}`;
const FINAL_KEY = `events/${EVENT}/posts/${UPLOAD}.pdf`;

const PDF_HEAD = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const membership = { id: MEMBER, userId: 'user', eventId: EVENT, role: 'PARTICIPANT' };
const quietConsole = { error() {}, log() {} };

const storageError = (code) => new types.StorageError(code, `fallo ${code}`);

// Almacenamiento falso: registra cada operación y se puede sustituir por método.
function fakeStorage(overrides = {}) {
  const calls = [];
  const record = (name, impl) => async (...args) => {
    calls.push([name, ...args]);
    return impl(...args);
  };
  return {
    calls,
    presignUpload: record('presignUpload', overrides.presignUpload ?? (async () => ({ url: 'https://r2.test/put', method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, expiresAt: new Date('2026-11-20T10:05:00Z') }))),
    presignDownload: record('presignDownload', overrides.presignDownload ?? (async () => ({ url: 'https://r2.test/get', expiresAt: new Date('2026-11-20T10:01:00Z') }))),
    head: record('head', overrides.head ?? (async () => ({ size: 1000, contentType: 'application/pdf' }))),
    readRange: record('readRange', overrides.readRange ?? (async () => PDF_HEAD)),
    copy: record('copy', overrides.copy ?? (async () => undefined)),
    delete: record('delete', overrides.delete ?? (async () => undefined)),
  };
}

const label = ({ table, op, payload }) => {
  if (table === 'attachment_uploads' && op === 'update') {
    if (payload && payload.consumed_at === null) return 'upload:release';
    if (payload && typeof payload.consumed_at === 'string') return 'upload:claim';
    if (payload && 'post_id' in payload) return 'upload:complete';
  }
  return `${table}:${op}`;
};

function setup({ db = () => undefined, storage = fakeStorage(), wallView = { canAccess: true, canPublish: true }, walls, quota = { level: 'disabled' } } = {}) {
  const events = [];
  const audits = [];
  const wallList = walls ?? [{ id: WALL, slug: 'general' }];
  const client = fakeSupabase((call) => {
    events.push(label(call));
    return db(call, label(call));
  });
  const service = loadTs(__dirname + '/attachments.service.ts', {
    'node:crypto': { randomUUID: () => UPLOAD },
    '../lib/supabase': { supabaseAdmin: client },
    '../lib/storage': { getFileStorage: () => storage },
    '../utils/attachments.utils': utils,
    '../utils/audit.logger': { logAudit: async (entry) => { audits.push(entry); } },
    '../utils/posts.utils': { findWallBySlug: (list, slug) => list.find((wall) => wall.slug === slug) ?? null },
    './walls.service': { loadWallsByEvent: async () => wallList, mapWallForMembership: () => wallView },
    './storage-quota.service': { checkUploadQuota: async () => quota },
  }, { console: quietConsole, setTimeout });
  service.attachmentSettings.copyRetryDelaysMs = [0, 0];
  return { service, events, audits, storage };
}

const body = (result) => JSON.parse(JSON.stringify(result.body));

// ---------------------------------------------------------------------------
// Inicio de subida

const initParams = (overrides = {}) => ({
  eventId: EVENT, membership, muro: 'general', fileName: 'acta.pdf', mimeType: 'application/pdf', size: 1000, ...overrides,
});

const counts = (pending, recent) => (call) => {
  if (call.table === 'attachment_uploads' && call.op === 'select') {
    return { count: call.steps.some((s) => s[0] === 'gte') ? recent : pending, error: null };
  }
  return undefined;
};

test('init: tipo o tamaño inválidos se rechazan sin tocar la base', async () => {
  const h = setup();
  for (const overrides of [{ mimeType: 'image/webp' }, { size: 31 * 1024 * 1024 }, { fileName: '' }]) {
    assert.equal((await h.service.initAttachmentUpload(initParams(overrides))).status, 400);
  }
  assert.deepEqual(h.events, []);
});

test('init: muro inexistente, sin acceso o sin permiso de publicar', async () => {
  assert.equal((await setup().service.initAttachmentUpload(initParams({ muro: 'otro' }))).status, 404);
  assert.equal((await setup({ wallView: { canAccess: false, canPublish: false } }).service.initAttachmentUpload(initParams())).status, 403);
  const readOnly = setup({ wallView: { canAccess: true, canPublish: false } });
  const result = await readOnly.service.initAttachmentUpload(initParams());
  assert.equal(result.status, 403);
  assert.deepEqual(readOnly.events, []);
});

test('init: límites por membresía salen de la base (429)', async () => {
  const tooManyPending = setup({ db: counts(14, 0) });
  assert.equal((await tooManyPending.service.initAttachmentUpload(initParams())).status, 429);
  assert.equal(tooManyPending.events.includes('attachment_uploads:insert'), false);

  const tooManyPerHour = setup({ db: counts(0, 60) });
  assert.equal((await tooManyPerHour.service.initAttachmentUpload(initParams())).status, 429);

  const justUnder = setup({ db: counts(13, 59) });
  assert.equal((await justUnder.service.initAttachmentUpload(initParams())).status, 201);
});

test('init: firma, registra el intento y devuelve la URL', async () => {
  let inserted;
  const h = setup({ db: (call) => { if (call.op === 'insert') inserted = { ...call.payload }; return counts(0, 0)(call); } });
  const result = await h.service.initAttachmentUpload(initParams());

  assert.equal(result.status, 201);
  assert.deepEqual(body(result).upload, {
    id: UPLOAD, url: 'https://r2.test/put', method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, expiresAt: '2026-11-20T10:05:00.000Z',
  });
  assert.deepEqual(h.storage.calls[0].slice(0, 1), ['presignUpload']);
  assert.deepEqual({ ...h.storage.calls[0][1] }, { key: PENDING_KEY, contentType: 'application/pdf', contentLength: 1000, expiresInSeconds: 300 });
  assert.equal(inserted.id, UPLOAD);
  assert.equal(inserted.event_id, EVENT);
  assert.equal(inserted.membership_id, MEMBER);
  assert.equal(inserted.wall_id, WALL);
  assert.equal(inserted.storage_key, PENDING_KEY);
  assert.equal(inserted.size_bytes, 1000);
  assert.ok(new Date(inserted.expires_at).getTime() > Date.now());
});

test('init: si falla la firma no queda intento registrado; sin configurar es 503', async () => {
  const broken = setup({ db: counts(0, 0), storage: fakeStorage({ presignUpload: async () => { throw storageError('UNAVAILABLE'); } }) });
  assert.equal((await broken.service.initAttachmentUpload(initParams())).status, 502);
  assert.equal(broken.events.includes('attachment_uploads:insert'), false);

  const unconfigured = setup({ db: counts(0, 0), storage: fakeStorage({ presignUpload: async () => { throw storageError('NOT_CONFIGURED'); } }) });
  assert.equal((await unconfigured.service.initAttachmentUpload(initParams())).status, 503);
});

// ---------------------------------------------------------------------------
// Reclamo del intento

const uploadRow = { id: UPLOAD, storage_key: PENDING_KEY, file_name: 'acta.pdf', mime_type: 'application/pdf', size_bytes: 1000 };
const claimParams = (overrides = {}) => ({ eventId: EVENT, membership, wallId: WALL, uploadId: UPLOAD, ...overrides });

// Base donde el reclamo atómico tiene éxito.
const claimable = (extra = () => undefined) => (call, name) => {
  if (name === 'upload:claim') return { data: uploadRow, error: null };
  return extra(call, name);
};

test('reclamo: camino feliz verifica el objeto y lo copia a la ruta final', async () => {
  let claimSteps;
  const h = setup({ db: (call, name) => { if (name === 'upload:claim') claimSteps = call.steps; return claimable()(call, name); } });
  const outcome = await h.service.claimUploadForPost(claimParams());

  assert.equal(outcome.kind, 'claimed');
  assert.equal(outcome.claim.finalKey, FINAL_KEY);
  assert.equal(outcome.claim.pendingKey, PENDING_KEY);
  assert.deepEqual(h.storage.calls.map((c) => c[0]), ['head', 'readRange', 'copy']);
  assert.deepEqual(h.storage.calls[2].slice(1), [PENDING_KEY, FINAL_KEY]);
  assert.deepEqual(h.events, ['upload:claim']);
  // El reclamo es atómico y está acotado por evento, dueño, muro, uso único y vigencia.
  assert.ok(hasStep(claimSteps, 'eq', 'event_id', EVENT));
  assert.ok(hasStep(claimSteps, 'eq', 'membership_id', MEMBER));
  assert.ok(hasStep(claimSteps, 'eq', 'wall_id', WALL));
  assert.ok(hasStep(claimSteps, 'is', 'consumed_at', null));
  assert.ok(claimSteps.some((s) => s[0] === 'gt' && s[1] === 'expires_at'));
});

test('reclamo: upload_id inválido es 400 sin consultar', async () => {
  const h = setup();
  const outcome = await h.service.claimUploadForPost(claimParams({ uploadId: '../x' }));
  assert.equal(outcome.kind, 'error');
  assert.equal(outcome.result.status, 400);
  assert.deepEqual(h.events, []);
});

const failedClaim = (row) => (call, name) => {
  if (name === 'upload:claim') return { data: null, error: null };
  if (call.table === 'attachment_uploads' && call.op === 'select') return { data: row, error: null };
  return undefined;
};

test('reclamo fallido: ajeno o inexistente responde 404 igual; otro evento también', async () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  const base = { event_id: EVENT, membership_id: MEMBER, wall_id: WALL, consumed_at: null, post_id: null, expires_at: future };
  for (const row of [null, { ...base, membership_id: 'otra' }, { ...base, event_id: 'otro-evento' }]) {
    const outcome = await setup({ db: failedClaim(row) }).service.claimUploadForPost(claimParams());
    assert.equal(outcome.result.status, 404);
  }
});

test('reclamo fallido: reintento devuelve el post, en proceso es 409, otro muro 400, vencido 410', async () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  const past = new Date(Date.now() - 60_000).toISOString();
  const base = { event_id: EVENT, membership_id: MEMBER, wall_id: WALL, consumed_at: null, post_id: null, expires_at: future };

  const replay = await setup({ db: failedClaim({ ...base, consumed_at: past, post_id: POST }) }).service.claimUploadForPost(claimParams());
  assert.deepEqual({ kind: replay.kind, postId: replay.postId }, { kind: 'replay', postId: POST });

  assert.equal((await setup({ db: failedClaim({ ...base, consumed_at: past }) }).service.claimUploadForPost(claimParams())).result.status, 409);
  assert.equal((await setup({ db: failedClaim({ ...base, wall_id: 'otro' }) }).service.claimUploadForPost(claimParams())).result.status, 400);
  assert.equal((await setup({ db: failedClaim({ ...base, expires_at: past }) }).service.claimUploadForPost(claimParams())).result.status, 410);
});

test('reclamo: objeto ausente libera el intento para reintentar (422)', async () => {
  const h = setup({ db: claimable(), storage: fakeStorage({ head: async () => null }) });
  const outcome = await h.service.claimUploadForPost(claimParams());
  assert.equal(outcome.result.status, 422);
  assert.deepEqual(h.events, ['upload:claim', 'upload:release']);
  assert.equal(h.storage.calls.some((c) => c[0] === 'delete'), false);
});

test('reclamo: objeto inválido se descarta y el intento queda gastado (422)', async () => {
  const cases = [
    { head: async () => ({ size: 999, contentType: 'application/pdf' }) },
    { head: async () => ({ size: 1000, contentType: 'image/png' }) },
    { readRange: async () => new TextEncoder().encode('<html>x') },
  ];
  for (const overrides of cases) {
    const h = setup({ db: claimable(), storage: fakeStorage(overrides) });
    const outcome = await h.service.claimUploadForPost(claimParams());
    assert.equal(outcome.result.status, 422);
    assert.deepEqual(h.events, ['upload:claim']);
    assert.deepEqual(h.storage.calls.filter((c) => c[0] === 'delete').map((c) => c[1]), [PENDING_KEY]);
    assert.equal(h.storage.calls.some((c) => c[0] === 'copy'), false);
  }
});

test('reclamo: la copia reintenta fallos transitorios', async () => {
  let attempts = 0;
  const h = setup({
    db: claimable(),
    storage: fakeStorage({ copy: async () => { attempts += 1; if (attempts < 3) throw storageError('UNAVAILABLE'); } }),
  });
  const outcome = await h.service.claimUploadForPost(claimParams());
  assert.equal(outcome.kind, 'claimed');
  assert.equal(attempts, 3);
});

test('reclamo: si la copia agota reintentos libera el intento (502)', async () => {
  let attempts = 0;
  const h = setup({
    db: claimable(),
    storage: fakeStorage({ copy: async () => { attempts += 1; throw storageError('UNAVAILABLE'); } }),
  });
  const outcome = await h.service.claimUploadForPost(claimParams());
  assert.equal(outcome.result.status, 502);
  assert.equal(attempts, 3);
  assert.deepEqual(h.events, ['upload:claim', 'upload:release']);
});

test('reclamo: origen inexistente al copiar no se reintenta (422)', async () => {
  let attempts = 0;
  const h = setup({
    db: claimable(),
    storage: fakeStorage({ copy: async () => { attempts += 1; throw storageError('NOT_FOUND'); } }),
  });
  const outcome = await h.service.claimUploadForPost(claimParams());
  assert.equal(outcome.result.status, 422);
  assert.equal(attempts, 1);
  assert.deepEqual(h.events, ['upload:claim', 'upload:release']);
});

test('reclamo: dos confirmaciones simultáneas, solo una gana', async () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  const past = new Date(Date.now() - 1000).toISOString();
  let claims = 0;
  const db = (call, name) => {
    if (name === 'upload:claim') { claims += 1; return claims === 1 ? { data: uploadRow, error: null } : { data: null, error: null }; }
    if (call.table === 'attachment_uploads' && call.op === 'select') {
      return { data: { event_id: EVENT, membership_id: MEMBER, wall_id: WALL, consumed_at: past, post_id: null, expires_at: future }, error: null };
    }
    return undefined;
  };
  const h = setup({ db });
  const [first, second] = await Promise.all([h.service.claimUploadForPost(claimParams()), h.service.claimUploadForPost(claimParams())]);
  assert.deepEqual([first.kind, second.kind].sort(), ['claimed', 'error']);
  assert.equal(second.result?.status ?? first.result.status, 409);
});

// ---------------------------------------------------------------------------
// Cierre y compensación

const claim = { uploadId: UPLOAD, eventId: EVENT, membershipId: MEMBER, pendingKey: PENDING_KEY, finalKey: FINAL_KEY, fileName: 'acta.pdf', mimeType: 'application/pdf', size: 1000 };

test('attachClaimedUpload inserta la fila definitiva y audita', async () => {
  let inserted;
  const h = setup({ db: (call) => { inserted = { ...call.payload }; return { data: { id: ATTACHMENT }, error: null }; } });
  assert.equal(await h.service.attachClaimedUpload({ claim, postId: POST, membership }), null);
  assert.deepEqual(inserted, {
    event_id: EVENT, post_id: POST, uploaded_by_membership_id: MEMBER, storage_path: FINAL_KEY, file_name: 'acta.pdf', mime_type: 'application/pdf', size_bytes: 1000, position: 0,
  });
  assert.equal(h.audits[0].actionType, 'UPLOAD_ATTACHMENT');
  assert.equal(h.audits[0].entityType, 'ATTACHMENT');
  assert.equal(h.audits[0].entityId, ATTACHMENT);
});

test('attachClaimedUpload devuelve el error y no audita si la inserción falla', async () => {
  const h = setup({ db: () => ({ data: null, error: { message: 'duplicate key' } }) });
  assert.equal(await h.service.attachClaimedUpload({ claim, postId: POST, membership }), 'duplicate key');
  assert.deepEqual(h.audits, []);
});

test('completeClaim enlaza el post y borra el temporal; tolera fallos del almacenamiento', async () => {
  const h = setup({ storage: fakeStorage({ delete: async () => { throw storageError('UNAVAILABLE'); } }) });
  await h.service.completeClaim(claim, POST);
  assert.deepEqual(h.events, ['upload:complete']);
  assert.deepEqual(h.storage.calls.map((c) => c.slice(0, 2)), [['delete', PENDING_KEY]]);
});

test('abortClaim borra el objeto final y libera el intento, aunque el borrado falle', async () => {
  const h = setup({ storage: fakeStorage({ delete: async () => { throw storageError('UNAVAILABLE'); } }) });
  await h.service.abortClaim(claim);
  assert.deepEqual(h.storage.calls.map((c) => c.slice(0, 2)), [['delete', FINAL_KEY]]);
  assert.deepEqual(h.events, ['upload:release']);
});

// ---------------------------------------------------------------------------
// Metadatos del feed

test('feed: adjunta metadatos sin URL y oculta el de posts eliminados', async () => {
  let steps;
  const h = setup({
    db: (call) => { steps = call.steps; return { data: [{ id: ATTACHMENT, post_id: 'a', file_name: 'x.pdf', mime_type: 'application/pdf', size_bytes: '2048' }, { id: 'otro', post_id: 'b', file_name: 'y.png', mime_type: 'image/png', size_bytes: 1 }], error: null }; },
  });
  const posts = await h.service.attachAttachmentsToPosts({
    posts: [{ id: 'a', user: { id: MEMBER } }, { id: 'b', isDeleted: true }, { id: 'c' }],
    eventId: EVENT,
    membershipId: MEMBER,
  });

  assert.deepEqual(JSON.parse(JSON.stringify(posts.map((p) => p.attachment))), [{ id: ATTACHMENT, name: 'x.pdf', mimeType: 'application/pdf', size: 2048, canRemove: true }, null, null]);
  assert.ok(hasStep(steps, 'eq', 'event_id', EVENT));
  assert.equal(JSON.stringify(posts).includes('http'), false);
});

test('feed: solo el autor puede retirar su adjunto', async () => {
  const h = setup({ db: () => ({ data: [{ id: ATTACHMENT, post_id: 'a', file_name: 'x.pdf', mime_type: 'application/pdf', size_bytes: 1 }], error: null }) });
  const [post] = await h.service.attachAttachmentsToPosts({ posts: [{ id: 'a', user: { id: 'otro' } }], eventId: EVENT, membershipId: MEMBER });
  assert.equal(post.attachment.canRemove, false);
});

test('feed: sin posts no consulta', async () => {
  const h = setup();
  assert.equal((await h.service.attachAttachmentsToPosts({ posts: [], eventId: EVENT, membershipId: MEMBER })).length, 0);
  assert.deepEqual(h.events, []);
});

// ---------------------------------------------------------------------------
// Descarga a demanda

const postRow = (overrides = {}) => ({ id: POST, event_id: EVENT, wall_id: WALL, status: 'VISIBLE', author_membership_id: 'autor', ...overrides });
const attachmentRow = { id: ATTACHMENT, storage_path: FINAL_KEY, file_name: 'acta.pdf', mime_type: 'application/pdf' };

const downloadDb = ({ post = postRow(), attachment = attachmentRow } = {}) => (call) => {
  if (call.table === 'posts') return { data: post, error: null };
  // La API lista los adjuntos del post (puede haber varios): la tabla devuelve un arreglo.
  if (call.table === 'attachments') return { data: attachment ? (Array.isArray(attachment) ? attachment : [attachment]) : [], error: null };
  return undefined;
};

test('descarga: devuelve URL de 60 segundos tras comprobar acceso', async () => {
  const h = setup({ db: downloadDb() });
  const result = await h.service.getAttachmentDownload({ postId: POST, eventId: EVENT, membership });

  assert.equal(result.status, 200);
  assert.deepEqual(body(result), { url: 'https://r2.test/get', expiresAt: '2026-11-20T10:01:00.000Z' });
  assert.deepEqual({ ...h.storage.calls[0][1] }, { key: FINAL_KEY, fileName: 'acta.pdf', contentType: 'application/pdf', expiresInSeconds: 60 });
});

test('descarga: post de otro evento, eliminado o sin adjunto es 404', async () => {
  assert.equal((await setup({ db: downloadDb({ post: null }) }).service.getAttachmentDownload({ postId: POST, eventId: EVENT, membership })).status, 404);
  assert.equal((await setup({ db: downloadDb({ post: postRow({ status: 'DELETED' }) }) }).service.getAttachmentDownload({ postId: POST, eventId: EVENT, membership })).status, 404);
  const noAttachment = setup({ db: downloadDb({ attachment: null }) });
  assert.equal((await noAttachment.service.getAttachmentDownload({ postId: POST, eventId: EVENT, membership })).status, 404);
  assert.equal(noAttachment.storage.calls.length, 0);
});

test('descarga: sin acceso al muro del post es 403 y no firma nada', async () => {
  const h = setup({ db: downloadDb(), wallView: { canAccess: false, canPublish: false } });
  const result = await h.service.getAttachmentDownload({ postId: POST, eventId: EVENT, membership });
  assert.equal(result.status, 403);
  assert.equal(h.storage.calls.length, 0);
});

test('descarga: la consulta del post va acotada al evento solicitado', async () => {
  const seen = [];
  const h = setup({ db: (call) => { seen.push(call); return downloadDb()(call); } });
  await h.service.getAttachmentDownload({ postId: POST, eventId: EVENT, membership });
  for (const call of seen) assert.ok(hasStep(call.steps, 'eq', 'event_id', EVENT), call.table);
});

test('descarga: fallo del almacenamiento es 502', async () => {
  const h = setup({ db: downloadDb(), storage: fakeStorage({ presignDownload: async () => { throw storageError('UNAVAILABLE'); } }) });
  assert.equal((await h.service.getAttachmentDownload({ postId: POST, eventId: EVENT, membership })).status, 502);
});

// ---------------------------------------------------------------------------
// Retiro

test('retiro por el autor: borra el objeto, luego la fila, y audita', async () => {
  const order = [];
  const storage = fakeStorage({ delete: async () => { order.push('storage'); } });
  const db = (call) => {
    if (call.op === 'delete') { order.push('row'); return { error: null }; }
    return downloadDb({ post: postRow({ author_membership_id: MEMBER }) })(call);
  };
  const h = setup({ db, storage });
  const result = await h.service.removeAttachment({ postId: POST, eventId: EVENT, membership, mode: 'AUTHOR' });

  assert.equal(result.status, 200);
  assert.deepEqual(order, ['storage', 'row']);
  assert.deepEqual(h.storage.calls[0].slice(0, 2), ['delete', FINAL_KEY]);
  assert.equal(h.audits[0].actionType, 'DELETE_ATTACHMENT');
  assert.equal(h.audits[0].entityId, ATTACHMENT);
});

test('retiro: quien no es autor recibe 403 y no se borra nada', async () => {
  const h = setup({ db: downloadDb() });
  const result = await h.service.removeAttachment({ postId: POST, eventId: EVENT, membership, mode: 'AUTHOR' });
  assert.equal(result.status, 403);
  assert.equal(h.storage.calls.length, 0);
  assert.deepEqual(h.audits, []);
});

test('retiro: el autor no puede retirar el adjunto de un post eliminado', async () => {
  const h = setup({ db: downloadDb({ post: postRow({ author_membership_id: MEMBER, status: 'DELETED' }) }) });
  assert.equal((await h.service.removeAttachment({ postId: POST, eventId: EVENT, membership, mode: 'AUTHOR' })).status, 404);
});

test('retiro por moderación: sin ser autor, con motivo auditado, también en posts eliminados', async () => {
  const moderator = { ...membership, id: 'mod', role: 'MODERATOR' };
  const db = (call) => (call.op === 'delete' ? { error: null } : downloadDb({ post: postRow({ status: 'DELETED' }) })(call));
  const h = setup({ db });
  const result = await h.service.removeAttachment({ postId: POST, eventId: EVENT, membership: moderator, mode: 'MODERATION', reason: '  Contenido no permitido  ' });

  assert.equal(result.status, 200);
  assert.equal(h.audits[0].actionType, 'MODERATE_DELETE_ATTACHMENT');
  assert.equal(h.audits[0].reason, 'Contenido no permitido');
  assert.equal(h.audits[0].targetMembershipId, 'autor');
  assert.equal(h.audits[0].membership, moderator);
});

test('retiro: si falla el borrado del objeto se conserva la fila (502)', async () => {
  const events = [];
  const db = (call) => { if (call.op === 'delete') events.push('row'); return downloadDb({ post: postRow({ author_membership_id: MEMBER }) })(call); };
  const h = setup({ db, storage: fakeStorage({ delete: async () => { throw storageError('UNAVAILABLE'); } }) });
  const result = await h.service.removeAttachment({ postId: POST, eventId: EVENT, membership, mode: 'AUTHOR' });
  assert.equal(result.status, 502);
  assert.deepEqual(events, []);
  assert.deepEqual(h.audits, []);
});

test('retiro: post o adjunto inexistente es 404', async () => {
  assert.equal((await setup({ db: downloadDb({ post: null }) }).service.removeAttachment({ postId: POST, eventId: EVENT, membership, mode: 'MODERATION', reason: 'xxx' })).status, 404);
  const none = setup({ db: downloadDb({ post: postRow({ author_membership_id: MEMBER }), attachment: null }) });
  assert.equal((await none.service.removeAttachment({ postId: POST, eventId: EVENT, membership, mode: 'AUTHOR' })).status, 404);
});

test('init: con la cuota al 95 % se rechaza la carga nueva (507) sin firmar ni registrar nada', async () => {
  const h = setup({ quota: { level: 'blocked', usedPercent: 96 } });
  const result = await h.service.initAttachmentUpload(initParams());

  assert.equal(result.status, 507);
  assert.match(body(result).error, /casi lleno/);
  assert.deepEqual(h.events, []);
  assert.equal(h.storage.calls.length, 0);
});

test('init: con alerta al 90 % la carga se acepta', async () => {
  const h = setup({ db: counts(0, 0), quota: { level: 'alert', usedPercent: 92 } });

  assert.equal((await h.service.initAttachmentUpload(initParams())).status, 201);
});

// ---------------------------------------------------------------------------
// Varios adjuntos por publicación (mejora 10)

const A1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const A2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const A3 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
const stored = (id, position, mime = 'image/jpeg', key = `events/${EVENT}/posts/${id}.jpg`) => ({ id, storage_path: key, file_name: `${id}.jpg`, mime_type: mime, position, created_at: '2026-11-25T10:00:00Z' });

test('varios adjuntos: el feed los devuelve en orden y conserva attachment (el primero)', async () => {
  const rows = [
    { id: A2, post_id: 'a', file_name: '2.png', mime_type: 'image/png', size_bytes: 20, position: 1, created_at: '2026-11-25T10:00:02Z' },
    { id: A3, post_id: 'a', file_name: 'acta.pdf', mime_type: 'application/pdf', size_bytes: 30, position: 2, created_at: '2026-11-25T10:00:03Z' },
    { id: A1, post_id: 'a', file_name: '1.jpg', mime_type: 'image/jpeg', size_bytes: 10, position: 0, created_at: '2026-11-25T10:00:01Z' },
    { id: 'zz', post_id: 'b', file_name: 'b.jpg', mime_type: 'image/jpeg', size_bytes: 1, position: 0 },
  ];
  const h = setup({ db: () => ({ data: rows, error: null }) });
  const posts = JSON.parse(JSON.stringify(await h.service.attachAttachmentsToPosts({
    posts: [{ id: 'a', user: { id: MEMBER } }, { id: 'b', isDeleted: true }, { id: 'c' }],
    eventId: EVENT,
    membershipId: MEMBER,
  })));

  assert.deepEqual(posts[0].attachments.map((item) => item.id), [A1, A2, A3]);
  assert.equal(posts[0].attachment.id, A1);
  assert.ok(posts[0].attachments.every((item) => item.canRemove === true));
  assert.deepEqual(posts[0].attachments.map((item) => item.size), [10, 20, 30]);
  // Un post eliminado no sirve sus adjuntos; uno sin adjuntos tiene lista vacía.
  assert.deepEqual(posts[1].attachments, []);
  assert.equal(posts[1].attachment, null);
  assert.deepEqual(posts[2].attachments, []);
});

test('varios adjuntos: sin posición definida se ordena por alta', () => {
  const { service } = setup();
  const sorted = service.sortAttachmentRows([
    { id: 'b', created_at: '2026-11-25T10:00:02Z' },
    { id: 'a', created_at: '2026-11-25T10:00:01Z' },
    { id: 'c', position: null, created_at: '2026-11-25T10:00:03Z' },
  ]);

  assert.deepEqual(JSON.parse(JSON.stringify(sorted.map((item) => item.id))), ['a', 'b', 'c']);
});

test('varios adjuntos: attachClaimedUpload guarda la posición indicada', async () => {
  let inserted;
  const h = setup({ db: (call) => { inserted = { ...call.payload }; return { data: { id: ATTACHMENT }, error: null }; } });
  await h.service.attachClaimedUpload({ claim, postId: POST, membership, position: 4 });

  assert.equal(inserted.position, 4);
});

test('varios adjuntos: se descarga el indicado por id y un id ajeno es 404', async () => {
  const all = [stored(A1, 0), stored(A2, 1, 'image/png', `events/${EVENT}/posts/${A2}.png`)];
  const ok = setup({ db: downloadDb({ attachment: all }) });
  const result = await ok.service.getAttachmentDownload({ postId: POST, eventId: EVENT, membership, attachmentId: A2 });

  assert.equal(result.status, 200);
  assert.equal(ok.storage.calls[0][1].key, `events/${EVENT}/posts/${A2}.png`);

  const wrong = setup({ db: downloadDb({ attachment: all }) });
  assert.equal((await wrong.service.getAttachmentDownload({ postId: POST, eventId: EVENT, membership, attachmentId: A3 })).status, 404);
  assert.equal((await wrong.service.getAttachmentDownload({ postId: POST, eventId: EVENT, membership, attachmentId: 'no-uuid' })).status, 404);
  assert.equal(wrong.storage.calls.length, 0);
});

test('varios adjuntos: sin id se descarga el primero (compatibilidad)', async () => {
  const h = setup({ db: downloadDb({ attachment: [stored(A2, 1), stored(A1, 0)] }) });
  await h.service.getAttachmentDownload({ postId: POST, eventId: EVENT, membership });

  assert.equal(h.storage.calls[0][1].key, `events/${EVENT}/posts/${A1}.jpg`);
});

test('varios adjuntos: retirar sin indicar cuál es 400 y no borra nada', async () => {
  const h = setup({ db: downloadDb({ post: postRow({ author_membership_id: MEMBER }), attachment: [stored(A1, 0), stored(A2, 1)] }) });
  const result = await h.service.removeAttachment({ postId: POST, eventId: EVENT, membership, mode: 'AUTHOR' });

  assert.equal(result.status, 400);
  assert.match(body(result).error, /attachment_id/);
  assert.equal(h.storage.calls.length, 0);
  assert.equal(h.events.includes('attachments:delete'), false);
});

test('varios adjuntos: retirar con id borra solo ese objeto y esa fila', async () => {
  let deletedFilter;
  const db = (call) => {
    if (call.op === 'delete') { deletedFilter = call.steps.find((step) => step[0] === 'eq' && step[1] === 'id'); return { error: null }; }
    return downloadDb({ post: postRow({ author_membership_id: MEMBER }), attachment: [stored(A1, 0), stored(A2, 1)] })(call);
  };
  const h = setup({ db });
  const result = await h.service.removeAttachment({ postId: POST, eventId: EVENT, membership, mode: 'AUTHOR', attachmentId: A2 });

  assert.equal(result.status, 200);
  assert.equal(h.storage.calls[0][1], `events/${EVENT}/posts/${A2}.jpg`);
  assert.equal(deletedFilter[2], A2);
  assert.equal(body(result).attachmentId, A2);
  assert.equal(h.audits[0].entityId, A2);
});

test('varios adjuntos: con un solo adjunto retirar sin id sigue funcionando', async () => {
  const db = (call) => {
    if (call.op === 'delete') return { error: null };
    return downloadDb({ post: postRow({ author_membership_id: MEMBER }), attachment: [stored(A1, 0)] })(call);
  };
  const h = setup({ db });

  assert.equal((await h.service.removeAttachment({ postId: POST, eventId: EVENT, membership, mode: 'AUTHOR' })).status, 200);
});

test('feed: sin la migración 007 (columna position inexistente) se reintenta y el feed sigue', async () => {
  let calls = 0;
  const h = setup({
    db: (call) => {
      if (call.table !== 'attachments') return undefined;
      calls += 1;
      if (calls === 1) return { data: null, error: { message: 'column attachments.position does not exist' } };
      return { data: [{ id: A2, post_id: 'a', file_name: 'b.jpg', mime_type: 'image/jpeg', size_bytes: 2, created_at: '2026-11-25T10:00:02Z' }, { id: A1, post_id: 'a', file_name: 'a.jpg', mime_type: 'image/jpeg', size_bytes: 1, created_at: '2026-11-25T10:00:01Z' }], error: null };
    },
  });
  const [post] = JSON.parse(JSON.stringify(await h.service.attachAttachmentsToPosts({ posts: [{ id: 'a', user: { id: MEMBER } }], eventId: EVENT, membershipId: MEMBER })));

  assert.equal(calls, 2);
  assert.deepEqual(post.attachments.map((item) => item.id), [A1, A2]);
});

test('feed: otro error de la base sí se propaga', async () => {
  const h = setup({ db: () => ({ data: null, error: { message: 'conexión rechazada' } }) });

  await assert.rejects(h.service.attachAttachmentsToPosts({ posts: [{ id: 'a' }], eventId: EVENT, membershipId: MEMBER }), /conexión rechazada/);
});
