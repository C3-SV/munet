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

const EVENT = 'event-1';
const CONVERSATION = { id: 'conv-1', event_id: EVENT, participant_a_membership_id: 'ana', participant_b_membership_id: 'beto', status: 'ACTIVE' };

// Supabase simulado: anota las operaciones sobre dm_messages y devuelve lo configurado.
function setup({ conversation = CONVERSATION, updatedRows = [], insertedRow = null, messages = [] } = {}) {
  const operations = [];
  const supabaseAdmin = {
    from(table) {
      const ops = [];
      const result = (terminal) => {
        if (table === 'dm_conversations') {
          if (ops.some((op) => op[0] === 'update')) return { data: null, error: null };
          return { data: conversation, error: null };
        }
        if (table === 'dm_messages') {
          operations.push(ops);
          if (ops.some((op) => op[0] === 'insert')) return { data: insertedRow, error: null };
          if (ops.some((op) => op[0] === 'update')) return { data: updatedRows, error: null };
          return { data: messages, error: null };
        }
        throw new Error(`Tabla inesperada: ${table}`);
      };
      const query = new Proxy({}, { get(_, method) {
        if (method === 'then') return (resolve) => resolve(result('then'));
        if (method === 'single' || method === 'maybeSingle') return () => Promise.resolve(result(method));
        return (...args) => { ops.push([method, ...args]); return query; };
      } });
      return query;
    },
  };
  const avatar = load(__dirname + '/../utils/avatar.utils.ts', {});
  const postsUtils = load(__dirname + '/../utils/posts.utils.ts', { './walls.utils': { buildWallSlug: () => 'general' }, './avatar.utils': avatar });
  const dmUtils = load(__dirname + '/../utils/dm.utils.ts', { './posts.utils': postsUtils, './avatar.utils': avatar });
  const service = load(__dirname + '/dm.service.ts', {
    '../lib/supabase': { supabaseAdmin },
    '../utils/audit.logger': { logAudit: async () => {} },
    '../utils/dm.utils': dmUtils,
    '../utils/posts.utils': postsUtils,
  });
  return { service, operations, dmUtils };
}

const me = (id) => ({ id, userId: 'u', role: 'PARTICIPANT', committeeId: null, accountStatus: 'ACTIVE' });
const markRead = (service, membershipId, conversationId = 'conv-1') =>
  service.markDmConversationRead({ eventId: EVENT, membership: me(membershipId), conversationId });
const has = (ops, ...expected) => ops.some((op) => expected.every((value, index) => op[index] === value));

test('marcar como leído actualiza solo los mensajes sin leer que envió la otra persona', async () => {
  const { service, operations } = setup({ updatedRows: [{ id: 'm1' }, { id: 'm2' }] });
  const result = await markRead(service, 'beto');

  assert.equal(result.status, 200);
  assert.equal(result.body.readCount, 2);
  assert.ok(result.body.readAt);

  const ops = operations[0];
  assert.ok(has(ops, 'eq', 'conversation_id', 'conv-1'));
  assert.ok(has(ops, 'eq', 'event_id', EVENT));
  // Nunca toca los mensajes propios: author != quien lee.
  assert.ok(has(ops, 'neq', 'author_membership_id', 'beto'));
  // Solo los pendientes y visibles.
  assert.ok(has(ops, 'is', 'read_at', null));
  assert.ok(has(ops, 'eq', 'status', 'VISIBLE'));
  assert.ok(has(ops, 'is', 'deleted_at', null));
  const update = ops.find((op) => op[0] === 'update')[1];
  assert.deepEqual(Object.keys(update), ['read_at']);
});

test('si no había nada pendiente responde 0 y sin fecha de lectura', async () => {
  const { service } = setup({ updatedRows: [] });
  const result = await markRead(service, 'ana');

  assert.equal(result.status, 200);
  assert.equal(result.body.readCount, 0);
  assert.equal(result.body.readAt, null);
});

test('quien escribe no marca como leídos sus propios mensajes', async () => {
  const { service, operations } = setup();
  await markRead(service, 'ana');

  assert.ok(has(operations[0], 'neq', 'author_membership_id', 'ana'));
});

test('una persona ajena a la conversación recibe 403 y no se escribe nada', async () => {
  const { service, operations } = setup();
  const result = await markRead(service, 'intruso');

  assert.equal(result.status, 403);
  assert.equal(operations.length, 0);
});

test('una conversación inexistente o inactiva no se puede marcar', async () => {
  const missing = setup({ conversation: null });
  assert.equal((await markRead(missing.service, 'ana')).status, 404);
  assert.equal(missing.operations.length, 0);

  const archived = setup({ conversation: { ...CONVERSATION, status: 'ARCHIVED' } });
  assert.equal((await markRead(archived.service, 'ana')).status, 403);
  assert.equal(archived.operations.length, 0);
});

test('los mensajes se listan con su fecha de lectura (readAt)', async () => {
  const { service } = setup({ messages: [
    { id: 'a', conversation_id: 'conv-1', author_membership_id: 'ana', content: 'Hola', status: 'VISIBLE', created_at: '2026-11-25T10:00:00Z', read_at: '2026-11-25T10:05:00Z' },
    { id: 'b', conversation_id: 'conv-1', author_membership_id: 'ana', content: 'Hola 2', status: 'VISIBLE', created_at: '2026-11-25T10:01:00Z', read_at: null },
    { id: 'c', conversation_id: 'conv-1', author_membership_id: 'ana', content: 'Hola 3', status: 'VISIBLE', created_at: '2026-11-25T10:02:00Z' },
  ] });
  const result = await service.listDmMessages({ eventId: EVENT, membership: me('ana'), conversationId: 'conv-1' });

  assert.deepEqual(result.body.messages.map((m) => m.readAt), ['2026-11-25T10:05:00Z', null, null]);
});

test('un mensaje recién enviado aún no está leído', async () => {
  const { service } = setup({ insertedRow: { id: 'n', event_id: EVENT, conversation_id: 'conv-1', author_membership_id: 'ana', content: 'Hola', status: 'VISIBLE', created_at: '2026-11-25T10:00:00Z', read_at: null } });
  const result = await service.createDmMessage({ eventId: EVENT, membership: me('ana'), conversationId: 'conv-1', content: 'Hola' });

  assert.equal(result.status, 201);
  assert.equal(result.body.message.readAt, null);
});

test('contadores: suma los mensajes sin leer por conversación, solo de la otra persona', async () => {
  const { service, operations } = setup({ messages: [{ conversation_id: 'c1' }, { conversation_id: 'c1' }, { conversation_id: 'c2' }] });
  const counts = await service.loadUnreadCountsByConversation(['c1', 'c2', 'c3'], 'ana');

  assert.equal(counts.get('c1'), 2);
  assert.equal(counts.get('c2'), 1);
  assert.equal(counts.get('c3'), undefined);

  const ops = operations[0];
  assert.ok(has(ops, 'neq', 'author_membership_id', 'ana'));
  assert.ok(has(ops, 'is', 'read_at', null));
  assert.ok(has(ops, 'eq', 'status', 'VISIBLE'));
  assert.ok(has(ops, 'is', 'deleted_at', null));
});

test('contadores: sin conversaciones no consulta y devuelve vacío', async () => {
  const { service, operations } = setup();
  const counts = await service.loadUnreadCountsByConversation([], 'ana');

  assert.equal(counts.size, 0);
  assert.equal(operations.length, 0);
});

test('la conversación incluye unreadCount (0 por defecto)', async () => {
  const { dmUtils } = setup();
  const conversation = { id: 'c1', event_id: EVENT, participant_a_membership_id: 'ana', participant_b_membership_id: 'beto', created_at: '2026-11-25T00:00:00Z', last_message_at: null, status: 'ACTIVE', participant_a: null, participant_b: null };

  assert.equal(dmUtils.mapDmConversation(conversation, 'ana').unreadCount, 0);
  assert.equal(dmUtils.mapDmConversation(conversation, 'ana', undefined, 4).unreadCount, 4);
});

// ---- Edición de mensajes ----
const MSG = { id: 'm1', author_membership_id: 'ana', content: 'Hola', status: 'VISIBLE', conversation_id: 'conv-1', created_at: '2026-11-25T10:00:00Z' };
const editMsg = (service, membershipId, content, over = {}) =>
  service.editDmMessage({ eventId: EVENT, membership: me(membershipId), conversationId: 'conv-1', messageId: 'm1', content, ...over });
const updateOf = (operations) => operations.flat().find((op) => op[0] === 'update')?.[1];

test('editar: el autor cambia su mensaje, queda editado y no se toca created_at', async () => {
  const { service, operations } = setup({ messages: MSG, updatedRows: { ...MSG, content: 'Hola corregido', edited_at: '2026-11-25T11:00:00Z' } });
  const result = await editMsg(service, 'ana', '  Hola corregido  ');

  assert.equal(result.status, 200);
  assert.equal(result.body.message.text, 'Hola corregido');
  assert.equal(result.body.message.editedAt, '2026-11-25T11:00:00Z');
  assert.equal(result.body.message.createdAt, '2026-11-25T10:00:00Z');

  const update = updateOf(operations);
  assert.deepEqual(Object.keys(update).sort(), ['content', 'edited_at', 'updated_at', 'updated_by_membership_id']);
  assert.equal(update.content, 'Hola corregido');
  assert.equal(update.updated_by_membership_id, 'ana');
});

test('editar: nunca modifica mensajes ajenos (403) y no escribe', async () => {
  const { service, operations } = setup({ messages: MSG });
  const result = await editMsg(service, 'beto', 'Cambio');

  assert.equal(result.status, 403);
  assert.equal(updateOf(operations), undefined);
});

test('editar: mensaje inexistente, eliminado u oculto responde 404', async () => {
  for (const messages of [null, { ...MSG, status: 'DELETED' }]) {
    const { service, operations } = setup({ messages });
    assert.equal((await editMsg(service, 'ana', 'Cambio')).status, 404);
    assert.equal(updateOf(operations), undefined);
  }
});

test('editar: contenido vacío o solo espacios responde 400', async () => {
  for (const content of ['', '   ', undefined, 5]) {
    const { service, operations } = setup({ messages: MSG });
    assert.equal((await editMsg(service, 'ana', content)).status, 400);
    assert.equal(operations.length, 0);
  }
});

test('editar: en una conversación ajena o inexistente no se edita', async () => {
  const foreign = setup({ messages: MSG });
  assert.equal((await editMsg(foreign.service, 'intruso', 'Cambio')).status, 403);
  assert.equal(foreign.operations.length, 0);

  const missing = setup({ conversation: null, messages: MSG });
  assert.equal((await editMsg(missing.service, 'ana', 'Cambio')).status, 404);
});

test('editar: si el texto no cambia no se marca como editado', async () => {
  const { service, operations } = setup({ messages: MSG });
  const result = await editMsg(service, 'ana', 'Hola');

  assert.equal(result.status, 200);
  assert.equal(result.body.message.editedAt, null);
  assert.equal(updateOf(operations), undefined);
});
