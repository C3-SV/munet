const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, console: { error() {} }, require(name) {
    assert.ok(name in imports, `Import inesperado: ${name}`);
    return imports[name];
  } });
  return module.exports;
}

const plain = (value) => JSON.parse(JSON.stringify(value));
const EVENT = 'event-1';
const POST = '11111111-1111-4111-8111-111111111111';
const POST_2 = '22222222-2222-4222-8222-222222222222';
const GENERAL = { id: 'w-general', event_id: EVENT, name: 'Muro General', wall_type: 'GENERAL', committee_id: null, deleted_at: null, committees: null };
const AVISOS = { id: 'w-avisos', event_id: EVENT, name: 'Anuncios', wall_type: 'ANNOUNCEMENTS', committee_id: null, deleted_at: null, committees: null };
const COMITE = { id: 'w-ag', event_id: EVENT, name: 'Muro Comite 1', wall_type: 'COMMITTEE', committee_id: 'ag', deleted_at: null, committees: { name: 'AG', code: 'AG', deleted_at: null } };

function setup({ walls = [GENERAL, AVISOS, COMITE], post = { id: POST, event_id: EVENT, wall_id: 'w-general', status: 'VISIBLE' }, posts = [], reactions = [], reactionsError = null } = {}) {
  const calls = [];
  const supabaseAdmin = {
    from(table) {
      const ops = [];
      calls.push({ table, ops });
      const result = () => {
        if (table === 'walls') return { data: walls, error: null };
        if (table === 'posts') return ops.some((op) => op[0] === 'in') ? { data: posts, error: null } : { data: post, error: null };
        if (table === 'post_reactions') {
          if (ops.some((op) => op[0] === 'upsert' || op[0] === 'delete')) return { data: null, error: null };
          return reactionsError ? { data: null, error: reactionsError } : { data: reactions, error: null };
        }
        throw new Error(`Tabla inesperada: ${table}`);
      };
      const query = new Proxy({}, { get(_, method) {
        if (method === 'then') return (resolve) => resolve(result());
        if (method === 'maybeSingle') return () => Promise.resolve(result());
        return (...args) => { ops.push([method, ...args]); return query; };
      } });
      return query;
    },
  };
  const rbac = load(__dirname + '/../utils/rbac.utils.ts', {});
  const wallsUtils = load(__dirname + '/../utils/walls.utils.ts', {});
  const wallsService = load(__dirname + '/walls.service.ts', { '../lib/supabase': { supabaseAdmin }, '../utils/rbac.utils': rbac, '../utils/walls.utils': wallsUtils });
  const reactionsUtils = load(__dirname + '/../utils/reactions.utils.ts', {});
  const service = load(__dirname + '/reactions.service.ts', { '../lib/supabase': { supabaseAdmin }, '../utils/reactions.utils': reactionsUtils, './walls.service': wallsService });
  return { service, calls };
}

const me = (role = 'PARTICIPANT', committeeId = null) => ({ id: 'yo', userId: 'u', eventId: EVENT, role, committeeId, accountStatus: 'ACTIVE' });
const has = (ops, ...expected) => ops.some((op) => expected.every((value, index) => op[index] === value));
const writes = (calls) => calls.filter((c) => c.ops.some((op) => op[0] === 'upsert' || op[0] === 'delete'));

test('agregar: guarda una reacción por persona y publicación en el muro del post', async () => {
  const { service, calls } = setup({ reactions: [{ post_id: POST, membership_id: 'yo', reaction: 'LOVE' }] });
  const result = await service.setPostReaction({ postId: POST, eventId: EVENT, membership: me(), reaction: 'LOVE' });

  assert.equal(result.status, 200);
  assert.deepEqual(plain(result.body.reactions), { counts: { LIKE: 0, LOVE: 1, LAUGH: 0, CLAP: 0 }, mine: 'LOVE' });

  const upsert = calls.find((c) => c.table === 'post_reactions').ops.find((op) => op[0] === 'upsert');
  assert.equal(upsert[1].post_id, POST);
  assert.equal(upsert[1].membership_id, 'yo');
  assert.equal(upsert[1].event_id, EVENT);
  assert.equal(upsert[1].wall_id, 'w-general');
  assert.equal(upsert[1].reaction, 'LOVE');
  // Cambiar de reacción reutiliza la misma fila: una sola por persona y publicación.
  assert.equal(upsert[2].onConflict, 'post_id,membership_id');
});

test('agregar: rechaza reacciones que no existen y no escribe', async () => {
  for (const reaction of ['ANGRY', 'like', '', null, undefined, 5]) {
    const { service, calls } = setup();
    const result = await service.setPostReaction({ postId: POST, eventId: EVENT, membership: me(), reaction });

    assert.equal(result.status, 400, String(reaction));
    assert.equal(writes(calls).length, 0);
  }
});

test('agregar: en avisos no hay reacciones', async () => {
  const { service, calls } = setup({ post: { id: POST, event_id: EVENT, wall_id: 'w-avisos', status: 'VISIBLE' } });
  const result = await service.setPostReaction({ postId: POST, eventId: EVENT, membership: me('ADMIN_MUN'), reaction: 'LIKE' });

  assert.equal(result.status, 403);
  assert.match(result.body.error, /canales, no en los avisos/);
  assert.equal(writes(calls).length, 0);
});

test('agregar: respeta el alcance del muro (otro comité no, su comité sí, moderador sí)', async () => {
  const post = { id: POST, event_id: EVENT, wall_id: 'w-ag', status: 'VISIBLE' };

  const other = setup({ post });
  assert.equal((await other.service.setPostReaction({ postId: POST, eventId: EVENT, membership: me('PARTICIPANT', 'otro'), reaction: 'LIKE' })).status, 403);
  assert.equal(writes(other.calls).length, 0);

  assert.equal((await setup({ post }).service.setPostReaction({ postId: POST, eventId: EVENT, membership: me('PARTICIPANT', 'ag'), reaction: 'LIKE' })).status, 200);
  assert.equal((await setup({ post }).service.setPostReaction({ postId: POST, eventId: EVENT, membership: me('MODERATOR'), reaction: 'LIKE' })).status, 200);
});

test('agregar: no se reacciona a publicaciones ocultas, eliminadas, de otro evento ni inexistentes', async () => {
  for (const post of [{ id: POST, event_id: EVENT, wall_id: 'w-general', status: 'HIDDEN' }, { id: POST, event_id: EVENT, wall_id: 'w-general', status: 'DELETED' }, { id: POST, event_id: 'otro', wall_id: 'w-general', status: 'VISIBLE' }, null]) {
    const { service, calls } = setup({ post });
    const result = await service.setPostReaction({ postId: POST, eventId: EVENT, membership: me(), reaction: 'LIKE' });

    assert.equal(result.status, 404, JSON.stringify(post));
    assert.equal(writes(calls).length, 0);
  }

  const malformed = setup();
  assert.equal((await malformed.service.setPostReaction({ postId: 'no-es-uuid', eventId: EVENT, membership: me(), reaction: 'LIKE' })).status, 404);
});

test('retirar: borra solo la reacción de esa persona en esa publicación', async () => {
  const { service, calls } = setup();
  const result = await service.removePostReaction({ postId: POST, eventId: EVENT, membership: me() });

  assert.equal(result.status, 200);
  assert.equal(result.body.reactions.mine, null);

  const ops = calls.find((c) => c.table === 'post_reactions' && c.ops.some((op) => op[0] === 'delete')).ops;
  assert.ok(has(ops, 'eq', 'post_id', POST));
  assert.ok(has(ops, 'eq', 'membership_id', 'yo'));
});

test('retirar: también respeta avisos y permisos', async () => {
  const avisos = setup({ post: { id: POST, event_id: EVENT, wall_id: 'w-avisos', status: 'VISIBLE' } });
  assert.equal((await avisos.service.removePostReaction({ postId: POST, eventId: EVENT, membership: me() })).status, 403);

  const ajeno = setup({ post: { id: POST, event_id: EVENT, wall_id: 'w-ag', status: 'VISIBLE' } });
  assert.equal((await ajeno.service.removePostReaction({ postId: POST, eventId: EVENT, membership: me('PARTICIPANT', 'otro') })).status, 403);
  assert.equal(writes(ajeno.calls).length, 0);
});

test('consulta por lote: solo devuelve publicaciones de muros accesibles', async () => {
  const { service } = setup({
    posts: [{ id: POST, wall_id: 'w-general' }, { id: POST_2, wall_id: 'w-ag' }],
    reactions: [{ post_id: POST, membership_id: 'a', reaction: 'CLAP' }, { post_id: POST_2, membership_id: 'a', reaction: 'LIKE' }],
  });
  const result = await service.listReactionsForPosts({ postIds: [POST, POST_2], eventId: EVENT, membership: me('PARTICIPANT', 'otro') });

  assert.equal(result.status, 200);
  assert.deepEqual(Object.keys(result.body.reactions), [POST]);
  assert.equal(result.body.reactions[POST].counts.CLAP, 1);
});

test('consulta por lote: valida los identificadores y el tamaño', async () => {
  const { service } = setup();

  assert.equal((await service.listReactionsForPosts({ postIds: [], eventId: EVENT, membership: me() })).status, 400);
  assert.equal((await service.listReactionsForPosts({ postIds: ['x', 'y'], eventId: EVENT, membership: me() })).status, 400);

  const many = Array.from({ length: 101 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
  assert.equal((await service.listReactionsForPosts({ postIds: many, eventId: EVENT, membership: me() })).status, 400);
});

test('feed: añade reactions a cada publicación y, si falla la lectura, deja los contadores en cero', async () => {
  const ok = setup({ reactions: [{ post_id: POST, membership_id: 'yo', reaction: 'LIKE' }] });
  const [withReactions] = await ok.service.attachReactions({ posts: [{ id: POST }], eventId: EVENT, membershipId: 'yo' });
  assert.equal(withReactions.reactions.mine, 'LIKE');
  assert.equal(withReactions.reactions.counts.LIKE, 1);

  const broken = setup({ reactionsError: { message: 'no existe la tabla' } });
  const [fallback] = await broken.service.attachReactions({ posts: [{ id: POST }], eventId: EVENT, membershipId: 'yo' });
  assert.deepEqual(plain(fallback.reactions), { counts: { LIKE: 0, LOVE: 0, LAUGH: 0, CLAP: 0 }, mine: null });

  assert.deepEqual(await ok.service.attachReactions({ posts: [], eventId: EVENT, membershipId: 'yo' }), []);
});
