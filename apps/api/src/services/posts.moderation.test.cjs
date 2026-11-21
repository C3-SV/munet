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
    './walls.service': { loadWallsByEvent: async () => [{ id: 'wall' }], mapWallForMembership: () => ({ canAccess: true }) },
  });
  const result = await service.getPostsByWall({ eventId: 'event', membership: { id: 'author' } });
  assert.deepEqual(result.body.posts.map(p => p.commentCount), [3, 0]);
  assert.ok(filters.some(f => f[0] === 'post_comments' && f[1] === 'eq' && f[2] === 'status' && f[3] === 'VISIBLE'));
  assert.ok(filters.some(f => f[0] === 'post_comments' && f[1] === 'eq' && f[2] === 'event_id' && f[3] === 'event'));
});
