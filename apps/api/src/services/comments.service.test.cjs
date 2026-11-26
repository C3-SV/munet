const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Carga un módulo TypeScript sustituyendo sus imports; así el servicio real corre sin Supabase.
function load(file, imports) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, console, require(name) {
    assert.ok(name in imports, `Import inesperado: ${name}`);
    return imports[name];
  } });
  return module.exports;
}

const EVENT = 'event-1';
const POST = 'post-1';
const GENERAL_WALL = { id: 'w-general', event_id: EVENT, name: 'Muro General', wall_type: 'GENERAL', committee_id: null, deleted_at: null, committees: null };
const ANNOUNCEMENTS_WALL = { id: 'w-avisos', event_id: EVENT, name: 'Anuncios', wall_type: 'ANNOUNCEMENTS', committee_id: null, deleted_at: null, committees: null };
const COMMITTEE_WALL = { id: 'w-ag', event_id: EVENT, name: 'Muro Comite 1', wall_type: 'COMMITTEE', committee_id: 'ag', deleted_at: null, committees: { name: 'Asamblea General', code: 'AG', deleted_at: null } };

// Supabase simulado: responde por tabla y anota los inserts de comentarios.
function setup({ wall, comments = [] }) {
  const inserts = [];
  const supabaseAdmin = {
    from(table) {
      const ops = [];
      const result = (terminal) => {
        if (table === 'posts') return { data: { id: POST, event_id: EVENT, wall_id: wall.id, status: 'VISIBLE' }, error: null };
        if (table === 'walls') return { data: [wall], error: null };
        if (table === 'post_comments') {
          const insert = ops.find((op) => op[0] === 'insert');
          if (insert) {
            inserts.push(insert[1]);
            return { data: { id: 'c-new', post_id: POST, parent_comment_id: insert[1].parent_comment_id, content: insert[1].content, created_at: '2026-11-25T00:00:00Z', updated_at: '2026-11-25T00:00:00Z', status: 'VISIBLE', deleted_by_actor_type: null, author_membership_id: insert[1].author_membership_id, event_memberships: null }, error: null };
          }
          if (terminal === 'maybeSingle') return { data: comments.find((c) => ops.some((op) => op[0] === 'eq' && op[1] === 'id' && op[2] === c.id)) ?? null, error: null };
          return { data: comments, error: null };
        }
        throw new Error(`Tabla inesperada: ${table}`);
      };
      const query = new Proxy({}, { get(_, method) {
        if (method === 'then') return (resolve) => resolve(result('then'));
        if (method === 'maybeSingle' || method === 'single') return () => Promise.resolve(result(method));
        return (...args) => { ops.push([method, ...args]); return query; };
      } });
      return query;
    },
  };
  const rbac = load(__dirname + '/../utils/rbac.utils.ts', {});
  const wallsUtils = load(__dirname + '/../utils/walls.utils.ts', {});
  const avatarUtils = load(__dirname + '/../utils/avatar.utils.ts', {});
  const postsUtils = load(__dirname + '/../utils/posts.utils.ts', { './walls.utils': wallsUtils, './avatar.utils': avatarUtils });
  const wallsService = load(__dirname + '/walls.service.ts', { '../lib/supabase': { supabaseAdmin }, '../utils/rbac.utils': rbac, '../utils/walls.utils': wallsUtils });
  const service = load(__dirname + '/comments.service.ts', {
    '../lib/supabase': { supabaseAdmin },
    '../utils/audit.logger': { logAudit: async () => {} },
    '../utils/avatar.utils': avatarUtils,
    '../utils/posts.utils': postsUtils,
    '../utils/rbac.utils': rbac,
    './walls.service': wallsService,
  });
  return { service, inserts };
}

const member = (role, committeeId = null) => ({ id: `m-${role}`, userId: 'u', role, committeeId, accountStatus: 'ACTIVE' });
const comment = (service, membership, extra = {}) => service.createPostComment({ postId: POST, eventId: EVENT, membership, content: 'Hola', ...extra });

test('avisos: un participante NO puede comentar ni responder', async () => {
  const { service, inserts } = setup({ wall: ANNOUNCEMENTS_WALL });
  const result = await comment(service, member('PARTICIPANT'));

  assert.equal(result.status, 403);
  assert.match(result.body.error, /avisos/);
  assert.equal(inserts.length, 0);
});

test('avisos: moderadores y administradores sí pueden comentar', async () => {
  for (const role of ['MODERATOR', 'ADMIN_MUN', 'ADMIN_TECH']) {
    const { service, inserts } = setup({ wall: ANNOUNCEMENTS_WALL });
    const result = await comment(service, member(role));

    assert.equal(result.status, 201, role);
    assert.equal(inserts.length, 1, role);
  }
});

test('avisos: un participante sí puede leer los comentarios', async () => {
  const { service } = setup({ wall: ANNOUNCEMENTS_WALL });
  const result = await service.listCommentsByPost({ postId: POST, eventId: EVENT, membership: member('PARTICIPANT') });

  assert.equal(result.status, 200);
});

test('avisos: un moderador puede responder a un comentario', async () => {
  const { service, inserts } = setup({
    wall: ANNOUNCEMENTS_WALL,
    comments: [{ id: 'parent', post_id: POST, parent_comment_id: null, status: 'VISIBLE' }],
  });
  const result = await comment(service, member('MODERATOR'), { parentCommentId: 'parent' });

  assert.equal(result.status, 201);
  assert.equal(inserts[0].parent_comment_id, 'parent');
});

test('canales normales: un participante comenta en el muro general', async () => {
  const { service, inserts } = setup({ wall: GENERAL_WALL });
  const result = await comment(service, member('PARTICIPANT'));

  assert.equal(result.status, 201);
  assert.equal(inserts.length, 1);
});

test('canales de comité: respeta el alcance (su comité sí, otro comité no)', async () => {
  const own = setup({ wall: COMMITTEE_WALL });
  assert.equal((await comment(own.service, member('PARTICIPANT', 'ag'))).status, 201);

  const other = setup({ wall: COMMITTEE_WALL });
  const denied = await comment(other.service, member('PARTICIPANT', 'otro'));
  assert.equal(denied.status, 403);
  assert.equal(other.inserts.length, 0);
});

const visible = (id, parent = null) => ({ id, post_id: POST, parent_comment_id: parent, status: 'VISIBLE' });

test('respuestas: se puede responder a un comentario raíz', async () => {
  const { service, inserts } = setup({ wall: GENERAL_WALL, comments: [visible('root')] });
  const result = await comment(service, member('PARTICIPANT'), { parentCommentId: 'root' });

  assert.equal(result.status, 201);
  assert.equal(inserts[0].parent_comment_id, 'root');
});

test('respuestas: se puede responder a una respuesta, sin error por el nivel de anidación', async () => {
  const { service, inserts } = setup({ wall: GENERAL_WALL, comments: [visible('root'), visible('reply', 'root')] });
  const result = await comment(service, member('PARTICIPANT'), { parentCommentId: 'reply' });

  assert.equal(result.status, 201);
  assert.equal(inserts.length, 1);
  // Queda asociada al comentario exacto al que se responde.
  assert.equal(inserts[0].parent_comment_id, 'reply');
  assert.equal(result.body.comment.parentCommentId, 'reply');
});

test('respuestas: se puede encadenar varios niveles', async () => {
  const chain = [visible('c1'), visible('c2', 'c1'), visible('c3', 'c2'), visible('c4', 'c3')];
  const { service } = setup({ wall: GENERAL_WALL, comments: chain });

  assert.equal((await comment(service, member('PARTICIPANT'), { parentCommentId: 'c4' })).status, 201);
});

test('respuestas: no se responde a un comentario oculto ni a uno eliminado', async () => {
  const hidden = setup({ wall: GENERAL_WALL, comments: [{ ...visible('h'), status: 'HIDDEN' }] });
  const h = await comment(hidden.service, member('PARTICIPANT'), { parentCommentId: 'h' });
  assert.equal(h.status, 404);
  assert.equal(hidden.inserts.length, 0);

  const deleted = setup({ wall: GENERAL_WALL, comments: [{ ...visible('d'), status: 'DELETED' }] });
  const d = await comment(deleted.service, member('PARTICIPANT'), { parentCommentId: 'd' });
  assert.equal(d.status, 400);
  assert.equal(deleted.inserts.length, 0);
});

test('respuestas: el padre debe ser del mismo post', async () => {
  const { service, inserts } = setup({ wall: GENERAL_WALL, comments: [{ ...visible('otro'), post_id: 'post-ajeno' }] });
  const result = await comment(service, member('PARTICIPANT'), { parentCommentId: 'otro' });

  assert.equal(result.status, 404);
  assert.equal(inserts.length, 0);
});

test('respuestas: respetan los permisos del canal (avisos y comités)', async () => {
  const chain = [visible('root'), visible('reply', 'root')];

  const avisos = setup({ wall: ANNOUNCEMENTS_WALL, comments: chain });
  assert.equal((await comment(avisos.service, member('PARTICIPANT'), { parentCommentId: 'reply' })).status, 403);
  assert.equal(avisos.inserts.length, 0);
  assert.equal((await comment(setup({ wall: ANNOUNCEMENTS_WALL, comments: chain }).service, member('MODERATOR'), { parentCommentId: 'reply' })).status, 201);

  const comite = setup({ wall: COMMITTEE_WALL, comments: chain });
  assert.equal((await comment(comite.service, member('PARTICIPANT', 'otro'), { parentCommentId: 'reply' })).status, 403);
  assert.equal(comite.inserts.length, 0);
});
