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

function harness({ db = () => undefined, copy } = {}) {
  const events = [];
  const storage = {
    head: async () => { events.push('storage:head'); return { size: 1000, contentType: 'application/pdf' }; },
    readRange: async () => { events.push('storage:readRange'); return PDF_HEAD; },
    copy: async (...args) => { events.push('storage:copy'); if (copy) return copy(...args); },
    delete: async (key) => { events.push(`storage:delete:${key === FINAL_KEY ? 'final' : 'pending'}`); },
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
      case 'upload:claim': return { data: uploadRow, error: null };
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
