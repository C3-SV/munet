const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadTs } = require('../test-helpers/load-ts.cjs');

const EVENT = '5b1d2c3e-4f50-4a61-8b72-9c83d4e5f601';
const OTHER_EVENT = '7c2e3d4f-5a61-4b72-9c83-0d1e2f3a4b5c';
const BASE_KEYS = ['id', 'created_at', 'action_type', 'entity_type', 'entity_id', 'outcome', 'reason',
  'actor_membership_id', 'actor_role', 'target_membership_id'];
const TECHNICAL_KEYS = ['actor_user_id', 'target_user_id', 'event_id', 'metadata', 'ip_address', 'user_agent'];

function harness({ role = 'ADMIN_MUN', membershipEvent = EVENT, query = {}, rows = [], error } = {}) {
  const calls = [];
  const client = { from(table) {
    const call = { table, steps: [] };
    calls.push(call);
    const result = error ? { error } : { data: rows };
    const builder = new Proxy({}, { get(_, method) {
      if (method === 'then') return (resolve, reject) => Promise.resolve(result).then(resolve, reject);
      return (...args) => { call.steps.push([method, ...args]); return builder; };
    } });
    return builder;
  } };
  const controller = loadTs(path.join(__dirname, 'admin-audit.controller.ts'), {
    '../lib/supabase': { supabaseAdmin: client },
    '../utils/rbac.utils': loadTs(path.join(__dirname, '..', 'utils', 'rbac.utils.ts'), {}),
  }, { console: { error() {} } });
  // JSON para comparar sin diferencias de contexto entre realms de vm.
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = JSON.parse(JSON.stringify(body)); return this; },
  };
  const membership = { id: 'admin-membership', userId: 'user', eventId: membershipEvent, role, accountStatus: 'ACTIVE' };
  const req = { query: { event_id: EVENT, ...query }, auth: { userId: 'user', memberships: [membership], currentMembership: membership } };
  return { controller, calls, res, req };
}

const sampleRow = (overrides = {}) => ({
  id: 'log-1',
  created_at: '2026-11-22T10:00:00.123456+00:00',
  action_type: 'SUSPEND_ACCOUNT',
  entity_type: 'MEMBERSHIP',
  entity_id: 'target-membership',
  outcome: 'SUCCESS',
  reason: 'Motivo registrado',
  actor_membership_id: 'admin-membership',
  actor_role: 'ADMIN_MUN',
  target_membership_id: 'target-membership',
  ...overrides,
});

test('ADMIN_MUN recibe solo acciones de cuidado general y ningun campo tecnico', async () => {
  const technical = { actor_user_id: 'user-1', target_user_id: 'user-2', event_id: EVENT, metadata: { payload: 'crudo' }, ip_address: '10.0.0.1', user_agent: 'agente' };
  const h = harness({ rows: [sampleRow(technical), sampleRow({ id: 'log-2', action_type: 'MODERATE_DELETE_POST', entity_type: 'POST', ...technical })] });
  await h.controller.listAuditLogs(h.req, h.res);
  assert.equal(h.res.statusCode, 200);
  const call = h.calls[0];
  assert.equal(call.table, 'audit_logs');

  const orStep = call.steps.find(step => step[0] === 'or');
  assert.ok(orStep, 'ADMIN_MUN debe filtrar por acciones de cuidado general');
  for (const action of ['MODERATE_DELETE_POST', 'MODERATE_DELETE_COMMENT', 'MODERATE_DELETE_ATTACHMENT', 'DELETE_POST', 'DELETE_COMMENT',
    'DELETE_ATTACHMENT', 'PIN_POST', 'UNPIN_POST', 'SUSPEND_ACCOUNT', 'REACTIVATE_ACCOUNT', 'RESET_PASSWORD', 'ACCESS_DENIED', 'HIDE_*', 'UNHIDE_*']) {
    assert.ok(orStep[1].includes(action), `falta ${action}`);
  }
  for (const action of ['CREATE_ACCOUNT', 'IMPORT_PARTICIPANTS', 'CHANGE_ROLE', 'CHANGE_COMMITTEE', 'UPDATE_PARTICIPANT', 'CREATE_EVENT',
    'UPDATE_EVENT', 'CREATE_MEMBERSHIP', 'DELETE_COMMITTEE', 'DELETE_DM_MESSAGE', 'SEND_DM_MESSAGE', 'CREATE_POST', 'UPLOAD_ATTACHMENT']) {
    assert.ok(!orStep[1].includes(action), `no debe incluir ${action}`);
  }

  const selectStep = call.steps.find(step => step[0] === 'select');
  for (const key of [...TECHNICAL_KEYS, 'actor_user_id']) assert.ok(!selectStep[1].includes(key), `select no debe pedir ${key}`);
  assert.ok(call.steps.some(step => step[0] === 'eq' && step[1] === 'event_id' && step[2] === EVENT));

  assert.equal(h.res.body.logs.length, 2);
  for (const log of h.res.body.logs) {
    assert.deepEqual(Object.keys(log).sort(), [...BASE_KEYS].sort());
    for (const key of TECHNICAL_KEYS) assert.ok(!(key in log), `respuesta no debe incluir ${key}`);
  }
  assert.equal(h.res.body.next_before, null);
});

test('ADMIN_TECH ve el registro completo del evento sin filtro de acciones', async () => {
  const h = harness({ role: 'ADMIN_TECH', rows: [sampleRow({ id: 'log-1', action_type: 'CREATE_ACCOUNT' })] });
  await h.controller.listAuditLogs(h.req, h.res);
  assert.equal(h.res.statusCode, 200);
  assert.ok(!h.calls[0].steps.some(step => step[0] === 'or'), 'ADMIN_TECH no debe filtrar por acciones');
  assert.ok(h.calls[0].steps.some(step => step[0] === 'eq' && step[1] === 'event_id' && step[2] === EVENT));
  assert.equal(h.res.body.logs[0].action_type, 'CREATE_ACCOUNT');
  assert.deepEqual(Object.keys(h.res.body.logs[0]).sort(), [...BASE_KEYS].sort());
});

test('limit: por defecto 50, maximo 100, y valores fuera de rango responden 400 sin consultar', async () => {
  for (const limit of ['0', '101', '-1', '1.5', 'abc', '', ['10'], '9007199254740993']) {
    const h = harness({ query: { limit } });
    await h.controller.listAuditLogs(h.req, h.res);
    assert.equal(h.res.statusCode, 400, `limit ${JSON.stringify(limit)} debe ser 400`);
    assert.equal(h.calls.length, 0);
  }
  const defaults = harness();
  await defaults.controller.listAuditLogs(defaults.req, defaults.res);
  assert.equal(defaults.res.statusCode, 200);
  assert.ok(defaults.calls[0].steps.some(step => step[0] === 'limit' && step[1] === 51));

  const max = harness({ query: { limit: '100' } });
  await max.controller.listAuditLogs(max.req, max.res);
  assert.equal(max.res.statusCode, 200);
  assert.ok(max.calls[0].steps.some(step => step[0] === 'limit' && step[1] === 101));
});

test('event_id es obligatorio, debe ser UUID y debe ser el evento de una membresia admin', async () => {
  for (const query of [{ event_id: undefined }, { event_id: '' }, { event_id: 'no-es-uuid' }, { event_id: ['a'] }]) {
    const h = harness({ query });
    await h.controller.listAuditLogs(h.req, h.res);
    assert.equal(h.res.statusCode, 400, JSON.stringify(query));
    assert.equal(h.calls.length, 0);
  }

  const foreign = harness({ membershipEvent: OTHER_EVENT });
  await foreign.controller.listAuditLogs(foreign.req, foreign.res);
  assert.equal(foreign.res.statusCode, 403);
  assert.equal(foreign.calls.length, 0);

  const moderator = harness({ role: 'MODERATOR' });
  await moderator.controller.listAuditLogs(moderator.req, moderator.res);
  assert.equal(moderator.res.statusCode, 403);
  assert.equal(moderator.calls.length, 0);

  const anonymous = harness();
  anonymous.req.auth.currentMembership = undefined;
  await anonymous.controller.listAuditLogs(anonymous.req, anonymous.res);
  assert.equal(anonymous.res.statusCode, 403);
  assert.equal(anonymous.calls.length, 0);
});

test('paginacion: next_before es el created_at de la ultima fila devuelta y before filtra por created_at', async () => {
  const rows = [
    sampleRow({ id: 'a', created_at: '2026-11-22T10:00:00.000003+00:00' }),
    sampleRow({ id: 'b', created_at: '2026-11-22T10:00:00.000002+00:00' }),
    sampleRow({ id: 'c', created_at: '2026-11-22T10:00:00.000001+00:00' }),
  ];
  const paged = harness({ query: { limit: '2' }, rows });
  await paged.controller.listAuditLogs(paged.req, paged.res);
  assert.deepEqual(paged.res.body.logs.map(log => log.id), ['a', 'b']);
  assert.equal(paged.res.body.next_before, '2026-11-22T10:00:00.000002+00:00');
  assert.ok(paged.calls[0].steps.some(step => step[0] === 'order' && step[1] === 'created_at' && step[2].ascending === false));
  assert.ok(paged.calls[0].steps.some(step => step[0] === 'order' && step[1] === 'id' && step[2].ascending === false));

  const lastPage = harness({ query: { limit: '2' }, rows: rows.slice(0, 2) });
  await lastPage.controller.listAuditLogs(lastPage.req, lastPage.res);
  assert.equal(lastPage.res.body.next_before, null);

  const cursor = '2026-11-22T10:00:00.000002+00:00';
  const next = harness({ query: { before: cursor, limit: '2' }, rows: [rows[2]] });
  await next.controller.listAuditLogs(next.req, next.res);
  assert.equal(next.res.statusCode, 200);
  assert.ok(next.calls[0].steps.some(step => step[0] === 'lt' && step[1] === 'created_at' && step[2] === cursor));
  assert.ok(next.calls[0].steps.some(step => step[0] === 'or'), 'ADMIN_MUN conserva el filtro de acciones con before');
  assert.deepEqual(next.res.body.logs.map(log => log.id), ['c']);
  assert.equal(next.res.body.next_before, null);
});

test('before exige ISO 8601 con zona horaria', async () => {
  for (const before of ['2026-11-22T10:00:00Z', '2026-11-22T10:00:00.123456+01:00', '2026-11-22T10:00Z']) {
    const h = harness({ query: { before } });
    await h.controller.listAuditLogs(h.req, h.res);
    assert.equal(h.res.statusCode, 200, before);
  }
  for (const before of ['2026-11-22', '2026-11-22T10:00:00', 'ayer', '2026-13-45T00:00:00Z', '', ['2026-11-22T10:00:00Z']]) {
    const h = harness({ query: { before } });
    await h.controller.listAuditLogs(h.req, h.res);
    assert.equal(h.res.statusCode, 400, JSON.stringify(before));
    assert.equal(h.calls.length, 0);
  }
});

test('un fallo de consulta responde 500 sin filtrar el error interno', async () => {
  const h = harness({ error: { message: 'fallo interno de base de datos' } });
  await h.controller.listAuditLogs(h.req, h.res);
  assert.equal(h.res.statusCode, 500);
  assert.deepEqual(h.res.body, { error: 'No se pudo consultar la auditoria' });
});
