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

const EVENT = 'event-1';
const AVISOS = { id: 'w-avisos', event_id: EVENT, name: 'Anuncios', wall_type: 'ANNOUNCEMENTS', committee_id: null, deleted_at: null, committees: null };
const GENERAL = { id: 'w-general', event_id: EVENT, name: 'Muro General', wall_type: 'GENERAL', committee_id: null, deleted_at: null, committees: null };
const ME = { id: 'yo', userId: 'u', eventId: EVENT, role: 'PARTICIPANT', committeeId: null, accountStatus: 'ACTIVE', createdAt: '2026-11-01T00:00:00Z' };

const postRow = (id, minute, extra = {}) => ({
  id, author_membership_id: 'otro', post_type: 'TEXT', content: `Aviso ${id}`, title: `Título ${id}`, status: 'VISIBLE',
  created_at: `2026-11-25T10:${String(minute).padStart(2, '0')}:00Z`, updated_at: `2026-11-25T10:${String(minute).padStart(2, '0')}:00Z`,
  deleted_by_membership_id: null, event_memberships: null, post_committee_tags: [], ...extra,
});

function setup({ walls = [AVISOS, GENERAL], lastRead = null, posts = [], postCount = null, conversations = [] } = {}) {
  const calls = [];
  const supabaseAdmin = {
    from(table) {
      const ops = [];
      const call = { table, ops };
      calls.push(call);
      const result = () => {
        if (table === 'walls') return { data: walls, error: null };
        if (table === 'wall_reads') {
          if (ops.some((op) => op[0] === 'upsert')) return { data: null, error: null };
          return { data: lastRead ? { last_read_at: lastRead } : null, error: null };
        }
        if (table === 'posts') return { data: posts, error: null, count: postCount ?? posts.length };
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
  const avatar = load(__dirname + '/../utils/avatar.utils.ts', {});
  const postsUtils = load(__dirname + '/../utils/posts.utils.ts', { './walls.utils': wallsUtils, './avatar.utils': avatar });
  const postsTypes = load(__dirname + '/../types/posts.types.ts', {});
  const wallsService = load(__dirname + '/walls.service.ts', { '../lib/supabase': { supabaseAdmin }, '../utils/rbac.utils': rbac, '../utils/walls.utils': wallsUtils });
  const service = load(__dirname + '/notifications.service.ts', {
    '../lib/supabase': { supabaseAdmin },
    '../types/posts.types': postsTypes,
    '../utils/posts.utils': postsUtils,
    './dm.service': { listDmConversations: async () => ({ status: 200, body: { conversations } }) },
    './walls.service': wallsService,
  });
  return { service, calls };
}

const conversation = (id, unreadCount, lastMessage = 'Hola') => ({ id, unreadCount, otherParticipant: { id: `p-${id}`, name: `Persona ${id}` }, lastMessage, lastMessageAt: '2026-11-25T10:00:00Z' });
const has = (ops, ...expected) => ops.some((op) => expected.every((value, index) => op[index] === value));

test('resumen: cuenta los mensajes directos sin leer y los suma al total', async () => {
  const { service } = setup({ conversations: [conversation('c1', 2), conversation('c2', 0), conversation('c3', 3, 'x'.repeat(300))], posts: [] });
  const { body } = await service.getNotificationSummary({ eventId: EVENT, membership: ME });

  assert.equal(body.unread.dms, 5);
  assert.equal(body.dms.length, 2);
  assert.deepEqual(body.dms.map((d) => d.conversationId), ['c1', 'c3']);
  // El texto se recorta para la notificación.
  assert.ok(body.dms[1].lastMessage.length <= 120);
  assert.equal(body.unread.total, 5);
  // Incluye todas las conversaciones, también las ya leídas, para suscribirse a ellas.
  assert.deepEqual(body.conversationIds, ['c1', 'c2', 'c3']);
});

test('resumen: avisos nuevos solo de otras personas, visibles y posteriores a la última lectura', async () => {
  const { service, calls } = setup({ lastRead: '2026-11-20T00:00:00Z', posts: [postRow('a2', 5), postRow('a1', 1)], postCount: 7 });
  const { body } = await service.getNotificationSummary({ eventId: EVENT, membership: ME });
  const postsOps = calls.find((c) => c.table === 'posts').ops;

  assert.ok(has(postsOps, 'eq', 'wall_id', 'w-avisos'));
  assert.ok(has(postsOps, 'eq', 'event_id', EVENT));
  assert.ok(has(postsOps, 'eq', 'status', 'VISIBLE'));
  assert.ok(has(postsOps, 'neq', 'author_membership_id', 'yo'));
  assert.ok(has(postsOps, 'gt', 'created_at', '2026-11-20T00:00:00Z'));

  assert.equal(body.announcements.unreadCount, 7);
  assert.equal(body.announcements.lastReadAt, '2026-11-20T00:00:00Z');
  assert.equal(body.announcements.slug, 'avisos');
  assert.deepEqual(body.announcements.latest.map((p) => p.postId), ['a2', 'a1']);
  assert.equal(body.announcements.latest[0].title, 'Título a2');
  assert.equal(body.unread.announcements, 7);
});

test('resumen: sin marca de lectura cuenta desde el alta de la membresía', async () => {
  const { service, calls } = setup({ lastRead: null, posts: [] });
  const { body } = await service.getNotificationSummary({ eventId: EVENT, membership: ME });

  assert.ok(has(calls.find((c) => c.table === 'posts').ops, 'gt', 'created_at', ME.createdAt));
  assert.equal(body.announcements.lastReadAt, ME.createdAt);
  assert.equal(body.announcements.unreadCount, 0);
});

test('resumen: un evento sin muro de avisos no devuelve avisos', async () => {
  const { service } = setup({ walls: [GENERAL], conversations: [conversation('c1', 1)] });
  const { body } = await service.getNotificationSummary({ eventId: EVENT, membership: ME });

  assert.equal(body.announcements, null);
  assert.equal(body.unread.announcements, 0);
  assert.equal(body.unread.total, 1);
});

test('marcar avisos como leídos guarda la marca para esa membresía y ese muro', async () => {
  const { service, calls } = setup();
  const result = await service.markAnnouncementsRead({ eventId: EVENT, membership: ME });

  assert.equal(result.status, 200);
  assert.ok(result.body.readAt);

  const upsert = calls.find((c) => c.table === 'wall_reads').ops.find((op) => op[0] === 'upsert');
  assert.equal(upsert[1].membership_id, 'yo');
  assert.equal(upsert[1].wall_id, 'w-avisos');
  assert.equal(upsert[1].last_read_at, result.body.readAt);
  assert.equal(upsert[2].onConflict, 'membership_id,wall_id');
});

test('marcar avisos como leídos sin muro de avisos responde 404 y no escribe', async () => {
  const { service, calls } = setup({ walls: [GENERAL] });
  const result = await service.markAnnouncementsRead({ eventId: EVENT, membership: ME });

  assert.equal(result.status, 404);
  assert.equal(calls.filter((c) => c.table === 'wall_reads').length, 0);
});
