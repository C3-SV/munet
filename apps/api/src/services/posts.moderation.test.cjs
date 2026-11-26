const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, console, require(name) {
    assert.ok(name in imports, `Import inesperado: ${name}`);
    return imports[name];
  } });
  return module.exports;
}

// Estas pruebas no ejercitan adjuntos: el servicio de adjuntos se sustituye por uno vacío.
const NO_ATTACHMENTS = {
  attachAttachmentsToPosts: async ({ posts }) => posts.map(post => ({ ...post, attachment: null })),
  claimUploadForPost: async () => assert.fail(),
  attachClaimedUpload: async () => assert.fail(),
  completeClaim: async () => assert.fail(),
  abortClaim: async () => assert.fail(),
};

test('feed selecciona y expone fijados y ordena antes de los posts recientes', async () => {
  const types = load(__dirname + '/../types/posts.types.ts', {});
  const utils = load(__dirname + '/../utils/posts.utils.ts', { './walls.utils': { buildWallSlug: () => 'general' } });
  const steps = [];
  const query = new Proxy({}, { get(_, method) {
    if (method === 'then') return resolve => resolve({ data: [{ id: 'p', post_type: 'TEXT', content: 'Hola', status: 'VISIBLE', created_at: '2026-11-18', is_pinned: true, pinned_at: '2026-11-18T10:00:00Z' }] });
    return (...args) => { steps.push([method, ...args]); return query; };
  } });
  const service = load(__dirname + '/posts.service.ts', {
    '../lib/supabase': { supabaseAdmin: { from: table => { assert.ok(['posts', 'post_comments'].includes(table)); return query; } } },
    '../types/posts.types': types,
    '../utils/audit.logger': { logAudit() { assert.fail(); } },
    '../utils/posts.utils': utils,
    '../utils/rbac.utils': { isAdminRole: () => false },
    './attachments.service': NO_ATTACHMENTS,
    './walls.service': { loadWallsByEvent: async () => [{ id: 'wall' }], mapWallForMembership: () => ({ canAccess: true }) },
  });
  const result = await service.getPostsByWall({ eventId: 'event', membership: { id: 'author' } });
  assert.equal(result.body.posts[0].isPinned, true);
  assert.equal(result.body.posts[0].pinnedAt, '2026-11-18T10:00:00Z');
  assert.match(types.POST_SELECT, /is_pinned/);
  assert.match(types.POST_SELECT, /pinned_at/);
  assert.deepEqual(steps.filter(s => s[0] === 'order').map(s => s[1]), ['is_pinned', 'pinned_at', 'created_at']);
  assert.ok(steps.filter(s => s[0] === 'order').every(s => s[2].ascending === false));
});

test('feed incluye commentCount con comentarios visibles por post', async () => {
  const types = load(__dirname + '/../types/posts.types.ts', {});
  const utils = load(__dirname + '/../utils/posts.utils.ts', { './walls.utils': { buildWallSlug: () => 'general' } });
  const filters = [];
  const dataByTable = {
    posts: [{ id: 'a', post_type: 'TEXT', content: 'A', status: 'VISIBLE', created_at: '2026-11-18' },
      { id: 'b', post_type: 'TEXT', content: 'B', status: 'VISIBLE', created_at: '2026-11-17' }],
    post_comments: [{ post_id: 'a' }, { post_id: 'a' }, { post_id: 'a' }],
  };
  const service = load(__dirname + '/posts.service.ts', {
    '../lib/supabase': { supabaseAdmin: { from: table => {
      const query = new Proxy({}, { get(_, method) {
        if (method === 'then') return resolve => resolve({ data: dataByTable[table] });
        return (...args) => { filters.push([table, method, ...args]); return query; };
      } });
      return query;
    } } },
    '../types/posts.types': types,
    '../utils/audit.logger': { logAudit() { assert.fail(); } },
    '../utils/posts.utils': utils,
    '../utils/rbac.utils': { isAdminRole: () => false },
    './attachments.service': NO_ATTACHMENTS,
    './walls.service': { loadWallsByEvent: async () => [{ id: 'wall' }], mapWallForMembership: () => ({ canAccess: true }) },
  });
  const result = await service.getPostsByWall({ eventId: 'event', membership: { id: 'author' } });
  assert.deepEqual(result.body.posts.map(p => p.commentCount), [3, 0]);
  assert.ok(filters.some(f => f[0] === 'post_comments' && f[1] === 'eq' && f[2] === 'status' && f[3] === 'VISIBLE'));
  assert.ok(filters.some(f => f[0] === 'post_comments' && f[1] === 'eq' && f[2] === 'event_id' && f[3] === 'event'));
});

// Consulta en memoria que devuelve siempre las filas fijadas de cada tabla y registra cada paso.
function simpleDb(dataByTable, log) {
  return { from: table => {
    const entry = { table, steps: [] };
    log.push(entry);
    const query = new Proxy({}, { get(_, method) {
      if (method === 'then') return resolve => resolve({ data: dataByTable[table] ?? null, error: null });
      return (...args) => { entry.steps.push([method, ...args]); return query; };
    } });
    return query;
  } };
}

const WALLS = {
  loadWallsByEvent: async () => [{ id: 'wall', event_id: 'event', name: 'General', wall_type: 'GENERAL', committee_id: null, committees: null }],
  mapWallForMembership: () => ({ canAccess: true, kind: 'general', canPublish: true }),
};

function loadPostsService(dataByTable, log) {
  return load(__dirname + '/posts.service.ts', {
    '../lib/supabase': { supabaseAdmin: simpleDb(dataByTable, log) },
    '../types/posts.types': load(__dirname + '/../types/posts.types.ts', {}),
    '../utils/audit.logger': { logAudit() { assert.fail(); } },
    '../utils/posts.utils': load(__dirname + '/../utils/posts.utils.ts', { './walls.utils': { buildWallSlug: () => 'general' } }),
    '../utils/rbac.utils': { isAdminRole: () => false },
    './attachments.service': NO_ATTACHMENTS,
    './walls.service': WALLS,
  });
}

function loadCommentsService(dataByTable, log) {
  return load(__dirname + '/comments.service.ts', {
    '../lib/supabase': { supabaseAdmin: simpleDb(dataByTable, log) },
    '../utils/audit.logger': { logAudit() { assert.fail(); } },
    '../utils/posts.utils': load(__dirname + '/../utils/posts.utils.ts', { './walls.utils': { buildWallSlug: () => 'general' } }),
    '../utils/rbac.utils': { isAdminRole: () => false },
    './walls.service': WALLS,
  });
}

test('feed omite los posts ocultos aunque la consulta los devuelva', async () => {
  const log = [];
  const service = loadPostsService({ posts: [
    { id: 'visible', post_type: 'TEXT', content: 'Visible', status: 'VISIBLE', created_at: '2026-11-18', is_pinned: false, deleted_at: null },
    { id: 'hidden', post_type: 'TEXT', content: 'Contenido oculto', status: 'HIDDEN', created_at: '2026-11-19', is_pinned: true, pinned_at: '2026-11-19T10:00:00Z', deleted_at: null },
  ] }, log);
  const result = await service.getPostsByWall({ eventId: 'event', membership: { id: 'reader', role: 'PARTICIPANT' } });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.posts.map(post => post.id), ['visible']);
  assert.ok(!JSON.stringify(result.body).includes('Contenido oculto'));
});

test('votar, cerrar o eliminar un post oculto responde 404 y no escribe nada', async () => {
  const hidden = { id: 'p', event_id: 'event', wall_id: 'wall', status: 'HIDDEN', author_membership_id: 'author', post_type: 'POLL', is_pinned: false, deleted_at: null };
  for (const action of ['voteOnPollService', 'closePollService', 'deletePostService']) {
    const log = [];
    const service = loadPostsService({ posts: hidden }, log);
    const result = await service[action]({ postId: 'p', eventId: 'event', membership: { id: 'author', role: 'PARTICIPANT' }, optionId: 'o1' });
    assert.equal(result.status, 404, action);
    assert.deepEqual(log.map(entry => entry.table), ['posts'], action);
    assert.ok(!log.some(entry => entry.steps.some(step => ['update', 'insert', 'delete'].includes(step[0]))), action);
  }
});

test('comentarios de un post oculto: no se listan ni se crean, y un padre oculto no admite respuestas', async () => {
  const member = { id: 'reader', role: 'PARTICIPANT' };

  const hiddenLog = [];
  const onHidden = loadCommentsService({ posts: { id: 'p', event_id: 'event', wall_id: 'wall', status: 'HIDDEN' } }, hiddenLog);
  const listed = await onHidden.listCommentsByPost({ postId: 'p', eventId: 'event', membership: member });
  assert.equal(listed.status, 404);
  assert.deepEqual(hiddenLog.map(entry => entry.table), ['posts']);

  const created = await onHidden.createPostComment({ postId: 'p', eventId: 'event', membership: member, content: 'Hola' });
  assert.equal(created.status, 404);
  assert.ok(!hiddenLog.some(entry => entry.steps.some(step => step[0] === 'insert')));

  const visibleLog = [];
  const onVisible = loadCommentsService({
    posts: { id: 'p', event_id: 'event', wall_id: 'wall', status: 'VISIBLE' },
    post_comments: [
      { id: 'c1', post_id: 'p', status: 'VISIBLE', content: 'Visible', created_at: '2026-11-18', author_membership_id: 'a', event_memberships: null, deleted_by_actor_type: null },
      { id: 'c2', post_id: 'p', status: 'HIDDEN', content: 'Oculto', created_at: '2026-11-18', author_membership_id: 'a', event_memberships: null, deleted_by_actor_type: null },
    ],
  }, visibleLog);
  const comments = await onVisible.listCommentsByPost({ postId: 'p', eventId: 'event', membership: member });
  assert.equal(comments.status, 200);
  assert.deepEqual(comments.body.comments.map(comment => comment.id), ['c1']);

  const parentLog = [];
  const withHiddenParent = loadCommentsService({
    posts: { id: 'p', event_id: 'event', wall_id: 'wall', status: 'VISIBLE' },
    post_comments: { id: 'parent', post_id: 'p', parent_comment_id: null, status: 'HIDDEN' },
  }, parentLog);
  const reply = await withHiddenParent.createPostComment({ postId: 'p', eventId: 'event', membership: member, content: 'Respuesta', parentCommentId: 'parent' });
  assert.equal(reply.status, 404);
  assert.ok(!parentLog.some(entry => entry.steps.some(step => step[0] === 'insert')));
});

test('eliminar un comentario oculto responde 404 y no lo cambia', async () => {
  const log = [];
  const service = loadCommentsService({
    posts: { id: 'p', event_id: 'event', wall_id: 'wall', status: 'VISIBLE' },
    post_comments: { id: 'c', post_id: 'p', author_membership_id: 'reader', status: 'HIDDEN' },
  }, log);
  const result = await service.deletePostComment({ postId: 'p', commentId: 'c', eventId: 'event', membership: { id: 'reader', role: 'PARTICIPANT' } });
  assert.equal(result.status, 404);
  assert.ok(!log.some(entry => entry.steps.some(step => step[0] === 'update')));
});
