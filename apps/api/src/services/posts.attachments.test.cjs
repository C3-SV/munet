const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('../test-helpers/load-ts.cjs');
const { fakeSupabase } = require('../test-helpers/fake-supabase.cjs');

// Orden de operaciones y compensaciones al crear un post con adjunto (plan §2.2).

const types = loadTs(__dirname + '/../lib/storage/types.ts');
const attachmentUtils = loadTs(__dirname + '/../utils/attachments.utils.ts');
const postTypes = loadTs(__dirname + '/../types/posts.types.ts');

const EVENT = '11111111-1111-4111-8111-111111111111';
const UPLOAD = '22222222-2222-4222-8222-222222222222';
const MEMBER = '33333333-3333-4333-8333-333333333333';
const WALL = '44444444-4444-4444-8444-444444444444';
const POST = '55555555-5555-4555-8555-555555555555';
const ATTACHMENT = '66666666-6666-4666-8666-666666666666';
const PENDING_KEY = `pending/${EVENT}/${UPLOAD}`;
const FINAL_KEY = `events/${EVENT}/posts/${UPLOAD}.pdf`;

const membership = { id: MEMBER, userId: 'user', eventId: EVENT, role: 'PARTICIPANT' };
const quietConsole = { error() {}, log() {} };
const PDF_HEAD = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const uploadRow = { id: UPLOAD, storage_key: PENDING_KEY, file_name: 'acta.pdf', mime_type: 'application/pdf', size_bytes: 1000 };
const postRow = { id: POST, post_type: 'TEXT', content: 'Hola', status: 'VISIBLE', created_at: '2026-11-20T10:00:00Z' };

const JPEG_HEAD = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

// `uploads` (opcional): intentos de subida por id, para publicar con varios archivos.
function harness({ db = () => undefined, copy, uploads } = {}) {
  const events = [];
  const uploadByKey = (key) => (uploads ? Object.values(uploads).find((upload) => upload.storage_key === key) : undefined);
  const storage = {
    head: async (key) => { events.push('storage:head'); const u = uploadByKey(key); return u ? { size: u.size_bytes, contentType: u.mime_type } : { size: 1000, contentType: 'application/pdf' }; },
    readRange: async (key) => { events.push('storage:readRange'); const u = uploadByKey(key); return u && u.mime_type.startsWith('image/') ? JPEG_HEAD : PDF_HEAD; },
    copy: async (...args) => { events.push('storage:copy'); if (copy) return copy(...args); },
    delete: async (key) => { events.push(`storage:delete:${key.startsWith('events/') ? 'final' : 'pending'}`); },
  };
  const label = ({ table, op, payload }) => {
    if (table === 'attachment_uploads' && op === 'update') {
      if (payload.consumed_at === null) return 'upload:release';
      if (typeof payload.consumed_at === 'string') return 'upload:claim';
      return 'upload:complete';
    }
    return `${table}:${op}`;
  };
  const client = fakeSupabase((call) => {
    const name = label(call);
    events.push(`db:${name}`);
    const custom = db(call, name);
    if (custom !== undefined) return custom;
    switch (name) {
      case 'upload:claim': {
        if (!uploads) return { data: uploadRow, error: null };
        const idStep = call.steps.find((step) => step[0] === 'eq' && step[1] === 'id');
        return { data: uploads[idStep?.[2]] ?? null, error: null };
      }
      case 'posts:insert': return { data: { ...postRow }, error: null };
      case 'posts:select': return { data: { ...postRow }, error: null };
      case 'post_comments:select': return { data: [], error: null };
      case 'attachments:insert': return { data: { id: ATTACHMENT }, error: null };
      case 'attachments:select': return { data: [{ id: ATTACHMENT, post_id: POST, file_name: 'acta.pdf', mime_type: 'application/pdf', size_bytes: 1000 }], error: null };
      default: return { data: null, error: null };
    }
  });
  const walls = [{ id: WALL, slug: 'general' }];
  const wallsService = { loadWallsByEvent: async () => walls, mapWallForMembership: () => ({ canAccess: true, canPublish: true }) };
  const postsUtils = {
    findWallBySlug: (list, slug) => list.find((wall) => wall.slug === slug) ?? null,
    mapPost: (post) => ({ id: post.id, content: post.content, isDeleted: post.status === 'DELETED' }),
  };
  const audits = [];
  const imports = {
    'node:crypto': { randomUUID: () => UPLOAD },
    '../lib/supabase': { supabaseAdmin: client },
    '../lib/storage': { getFileStorage: () => storage },
    '../utils/attachments.utils': attachmentUtils,
    '../utils/audit.logger': { logAudit: async (entry) => { audits.push(entry.actionType); } },
    '../utils/posts.utils': postsUtils,
    '../utils/rbac.utils': { isAdminRole: () => false },
    '../types/posts.types': postTypes,
    './reactions.service': { attachReactions: async ({ posts }) => posts },
    './storage-quota.service': { checkUploadQuota: async () => ({ level: 'disabled' }) },
    './walls.service': wallsService,
  };
  const attachments = loadTs(__dirname + '/attachments.service.ts', imports, { console: quietConsole, setTimeout });
  attachments.attachmentSettings.copyRetryDelaysMs = [0, 0];
  const posts = loadTs(__dirname + '/posts.service.ts', { ...imports, './attachments.service': attachments }, { console: quietConsole });
  return { posts, events, audits };
}

const create = (h, overrides = {}) =>
  h.posts.createPostService({ muro: 'general', content: 'Hola', eventId: EVENT, membership, uploadId: UPLOAD, ...overrides });

test('con adjunto: reclama, verifica, copia, crea el post, guarda la fila y cierra el intento', async () => {
  const h = harness();
  const result = await create(h);

  assert.equal(result.status, 201);
  assert.deepEqual(h.events.slice(0, 8), [
    'db:upload:claim',
    'storage:head',
    'storage:readRange',
    'storage:copy',
    'db:posts:insert',
    'db:attachments:insert',
    'db:upload:complete',
    'storage:delete:pending',
  ]);
  assert.equal(h.audits.includes('UPLOAD_ATTACHMENT'), true);
  assert.deepEqual(JSON.parse(JSON.stringify(result.body.post.attachment)), { id: ATTACHMENT, name: 'acta.pdf', mimeType: 'application/pdf', size: 1000, canRemove: false });
  assert.equal(h.events.some((event) => event.startsWith('storage:delete:final')), false);
});

test('si falla la fila del adjunto: se borra el post y el objeto final y se libera el intento', async () => {
  const h = harness({ db: (_call, name) => (name === 'attachments:insert' ? { data: null, error: { message: 'duplicate key' } } : undefined) });
  const result = await create(h);

  assert.equal(result.status, 400);
  assert.deepEqual(h.events.slice(-3), ['db:posts:delete', 'storage:delete:final', 'db:upload:release']);
  assert.equal(h.audits.includes('UPLOAD_ATTACHMENT'), false);
  assert.equal(h.events.includes('storage:delete:pending'), false);
});

test('si falla el insert del post: se borra el objeto final y se libera el intento', async () => {
  const h = harness({ db: (_call, name) => (name === 'posts:insert' ? { data: null, error: { message: 'boom' } } : undefined) });
  const result = await create(h);

  assert.equal(result.status, 400);
  assert.equal(h.events.includes('db:attachments:insert'), false);
  assert.deepEqual(h.events.slice(-2), ['storage:delete:final', 'db:upload:release']);
});

test('si falla la encuesta de un post con adjunto: se compensa igual', async () => {
  const h = harness({
    db: (_call, name) => (name === 'polls:insert' ? { data: null, error: { message: 'sin encuesta' } } : undefined),
  });
  const result = await create(h, { postType: 'POLL', pollOptions: ['Sí', 'No'] });

  assert.equal(result.status, 400);
  assert.deepEqual(h.events.slice(-3), ['db:posts:delete', 'storage:delete:final', 'db:upload:release']);
});

test('si falla la copia: no se crea post y el intento queda libre', async () => {
  const h = harness({ copy: async () => { throw new types.StorageError('UNAVAILABLE', 'caído'); } });
  const result = await create(h);

  assert.equal(result.status, 502);
  assert.equal(h.events.includes('db:posts:insert'), false);
  assert.equal(h.events.at(-1), 'db:upload:release');
});

test('reintento del cliente: devuelve el post ya creado sin duplicar', async () => {
  const past = new Date(Date.now() - 1000).toISOString();
  const future = new Date(Date.now() + 60_000).toISOString();
  const h = harness({
    db: (call, name) => {
      if (name === 'upload:claim') return { data: null, error: null };
      if (call.table === 'attachment_uploads' && call.op === 'select') {
        return { data: { event_id: EVENT, membership_id: MEMBER, wall_id: WALL, consumed_at: past, post_id: POST, expires_at: future }, error: null };
      }
      return undefined;
    },
  });
  const result = await create(h);

  assert.equal(result.status, 200);
  assert.equal(result.body.post.id, POST);
  assert.equal(h.events.includes('db:posts:insert'), false);
  assert.equal(h.events.some((event) => event.startsWith('storage:')), false);
});

test('intento ajeno: 404 y no se crea nada', async () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  const h = harness({
    db: (call, name) => {
      if (name === 'upload:claim') return { data: null, error: null };
      if (call.table === 'attachment_uploads' && call.op === 'select') {
        return { data: { event_id: EVENT, membership_id: 'otra-membresia', wall_id: WALL, consumed_at: null, post_id: null, expires_at: future }, error: null };
      }
      return undefined;
    },
  });
  const result = await create(h);

  assert.equal(result.status, 404);
  assert.equal(h.events.includes('db:posts:insert'), false);
});

test('sin upload_id el flujo no toca adjuntos ni almacenamiento', async () => {
  const h = harness();
  const result = await create(h, { uploadId: undefined });

  assert.equal(result.status, 201);
  assert.equal(h.events.some((event) => event.startsWith('storage:') || event.includes('upload')), false);
  assert.equal(h.events.includes('db:attachments:insert'), false);
});

// ---------------------------------------------------------------------------
// Varios adjuntos por publicación (mejora 10)

const uuid = (n) => `99999999-9999-4999-8999-${String(n).padStart(12, '0')}`;
const upload = (n, mime = 'image/jpeg', size = 2000) => ({
  id: uuid(n),
  storage_key: `pending/${EVENT}/${uuid(n)}`,
  file_name: mime === 'application/pdf' ? `doc-${n}.pdf` : `foto-${n}.jpg`,
  mime_type: mime,
  size_bytes: size,
});
const setOf = (...items) => Object.fromEntries(items.map((item) => [item.id, item]));
const count = (events, name) => events.filter((event) => event === name).length;

test('varios adjuntos: reclama todos, crea el post una vez y guarda cada fila con su posición', async () => {
  const items = [upload(1), upload(2), upload(3, 'application/pdf', 5000)];
  const inserted = [];
  const h = harness({
    uploads: setOf(...items),
    db: (call, name) => { if (name === 'attachments:insert') inserted.push({ ...call.payload }); },
  });
  const result = await create(h, { uploadId: undefined, uploadIds: items.map((item) => item.id) });

  assert.equal(result.status, 201);
  assert.equal(count(h.events, 'db:upload:claim'), 3);
  assert.equal(count(h.events, 'storage:copy'), 3);
  assert.equal(count(h.events, 'db:posts:insert'), 1);
  assert.equal(count(h.events, 'db:attachments:insert'), 3);
  assert.equal(count(h.events, 'db:upload:complete'), 3);
  assert.equal(count(h.events, 'storage:delete:pending'), 3);
  assert.equal(h.events.some((event) => event.startsWith('storage:delete:final')), false);
  // El orden elegido se conserva en la posición de cada fila.
  assert.deepEqual(inserted.map((row) => row.position), [0, 1, 2]);
  assert.deepEqual(inserted.map((row) => row.mime_type), ['image/jpeg', 'image/jpeg', 'application/pdf']);
  assert.equal(h.audits.filter((action) => action === 'UPLOAD_ATTACHMENT').length, 3);
});

test('varios adjuntos: hasta 10 imágenes y 2 PDF juntos se aceptan', async () => {
  const items = [...Array.from({ length: 10 }, (_, i) => upload(i + 1)), upload(11, 'application/pdf', 4000), upload(12, 'application/pdf', 4000)];
  const h = harness({ uploads: setOf(...items) });
  const result = await create(h, { uploadId: undefined, uploadIds: items.map((item) => item.id) });

  assert.equal(result.status, 201);
  assert.equal(count(h.events, 'db:attachments:insert'), 12);
});

test('varios adjuntos: la imagen 11 se rechaza, se devuelven los intentos y no se crea el post', async () => {
  const items = Array.from({ length: 11 }, (_, i) => upload(i + 1));
  const h = harness({ uploads: setOf(...items) });
  const result = await create(h, { uploadId: undefined, uploadIds: items.map((item) => item.id) });

  assert.equal(result.status, 400);
  assert.match(result.body.error, /10 imágenes/);
  assert.equal(h.events.includes('db:posts:insert'), false);
  assert.equal(count(h.events, 'storage:delete:final'), 11);
  assert.equal(count(h.events, 'db:upload:release'), 11);
});

test('varios adjuntos: el PDF 3 se rechaza', async () => {
  const items = [1, 2, 3].map((n) => upload(n, 'application/pdf', 4000));
  const h = harness({ uploads: setOf(...items) });
  const result = await create(h, { uploadId: undefined, uploadIds: items.map((item) => item.id) });

  assert.equal(result.status, 400);
  assert.match(result.body.error, /2 archivos PDF/);
  assert.equal(h.events.includes('db:posts:insert'), false);
});

test('varios adjuntos: más de 12 archivos se rechazan sin reclamar nada', async () => {
  const h = harness();
  const result = await create(h, { uploadId: undefined, uploadIds: Array.from({ length: 13 }, (_, i) => uuid(i + 1)) });

  assert.equal(result.status, 400);
  assert.match(result.body.error, /hasta 12 archivos/);
  assert.deepEqual(h.events, []);
});

test('varios adjuntos: una subida repetida o una lista inválida se rechaza sin reclamar nada', async () => {
  const repeated = harness();
  assert.equal((await create(repeated, { uploadId: undefined, uploadIds: [uuid(1), uuid(1)] })).status, 400);
  assert.deepEqual(repeated.events, []);

  const notAList = harness();
  assert.equal((await create(notAList, { uploadId: undefined, uploadIds: 'x' })).status, 400);
  assert.deepEqual(notAList.events, []);
});

test('varios adjuntos: si una subida falla, las demás se devuelven y no se crea el post', async () => {
  const items = [upload(1), upload(2)];
  const h = harness({
    uploads: setOf(...items),
    db: (call, name) => {
      if (call.table === 'attachment_uploads' && call.op === 'select') return { data: null, error: null };
    },
  });
  // La segunda subida no existe: el reclamo falla con 404 y la primera se compensa.
  const result = await create(h, { uploadId: undefined, uploadIds: [uuid(1), uuid(99)] });

  assert.equal(result.status, 404);
  assert.equal(h.events.includes('db:posts:insert'), false);
  assert.equal(count(h.events, 'storage:delete:final'), 1);
  assert.equal(count(h.events, 'db:upload:release'), 1);
});

test('varios adjuntos: si falla la fila de uno, se borra el post y se compensan todos', async () => {
  const items = [upload(1), upload(2), upload(3)];
  let attempts = 0;
  const h = harness({
    uploads: setOf(...items),
    db: (_call, name) => {
      if (name === 'attachments:insert') { attempts += 1; if (attempts === 2) return { data: null, error: { message: 'duplicate key' } }; }
    },
  });
  const result = await create(h, { uploadId: undefined, uploadIds: items.map((item) => item.id) });

  assert.equal(result.status, 400);
  assert.equal(count(h.events, 'db:posts:delete'), 1);
  assert.equal(count(h.events, 'storage:delete:final'), 3);
  assert.equal(count(h.events, 'db:upload:release'), 3);
  assert.equal(h.events.includes('db:upload:complete'), false);
});

test('varios adjuntos: upload_id (uno solo) sigue funcionando como antes', async () => {
  const h = harness();
  const result = await create(h);

  assert.equal(result.status, 201);
  assert.equal(count(h.events, 'db:attachments:insert'), 1);
});
