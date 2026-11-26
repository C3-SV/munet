const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadTs } = require('../test-helpers/load-ts.cjs');

const EVENT = '5b1d2c3e-4f50-4a61-8b72-9c83d4e5f601';
const OTHER_EVENT = '7c2e3d4f-5a61-4b72-9c83-0d1e2f3a4b5c';
const BASE_KEYS = ['id', 'created_at', 'action_type', 'entity_type', 'entity_id', 'outcome', 'reason',
  'actor_membership_id', 'actor_role', 'target_membership_id'];
const TECHNICAL_KEYS = ['actor_user_id', 'target_user_id', 'event_id', 'metadata', 'ip_address', 'user_agent'];

function harness({ role = 'ADMIN_MUN', membershipEvent = EVENT, query = {}, rows = [], error, evaluate } = {}) {
  const calls = [];
  const client = { from(table) {
    const call = { table, steps: [] };
    calls.push(call);
    const builder = new Proxy({}, { get(_, method) {
      // El resultado se calcula al resolver la consulta, con todos los pasos ya registrados.
      if (method === 'then') return (resolve, reject) => Promise.resolve(error ? { error } : { data: evaluate ? evaluate(call.steps) : rows }).then(resolve, reject);
      return (...args) => { call.steps.push([method, ...args]); return builder; };
    } });
    return builder;
  } };
  const controller = loadTs(path.join(__dirname, 'admin-audit.controller.ts'), {
    '../lib/supabase': { supabaseAdmin: client },
    '../utils/rbac.utils': loadTs(path.join(__dirname, '..', 'utils', 'rbac.utils.ts'), {}),
  }, { console: { error() {} }, Buffer });
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

const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const encodeCursor = text => Buffer.from(text, 'utf8').toString('base64url');
const cursorOr = (createdAt, id) => `created_at.lt."${createdAt}",and(created_at.eq."${createdAt}",id.lt."${id}")`;

// Evaluador minimo de la consulta: solo las operaciones que usa el controlador, para comprobar el orden y el corte de pagina.
const CURSOR_OR = /^created_at\.lt\."([^"]+)",and\(created_at\.eq\."\1",id\.lt\."([^"]+)"\)$/;
function evaluateSteps(steps, table) {
  let rows = table.slice();
  const orders = [];
  let limit = Infinity;
  for (const [method, ...args] of steps) {
    if (method === 'eq') rows = rows.filter(row => row[args[0]] === args[1]);
    else if (method === 'lt') rows = rows.filter(row => row[args[0]] < args[1]);
    else if (method === 'or') {
      const match = CURSOR_OR.exec(args[0]);
      if (!match) throw new Error(`filtro or no soportado por el evaluador: ${args[0]}`);
      const [, createdAt, id] = match;
      rows = rows.filter(row => row.created_at < createdAt || (row.created_at === createdAt && row.id < id));
    } else if (method === 'order') orders.push({ column: args[0], ascending: args[1].ascending });
    else if (method === 'limit') limit = args[0];
  }
  rows.sort((a, b) => {
    for (const { column, ascending } of orders) {
      if (a[column] !== b[column]) return (a[column] < b[column] ? -1 : 1) * (ascending ? 1 : -1);
    }
    return 0;
  });
  return rows.slice(0, limit);
}

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

test('paginacion: next_before es un cursor con created_at e id de la ultima fila devuelta; before ISO filtra por created_at', async () => {
  const rows = [
    sampleRow({ id: 'a', created_at: '2026-11-22T10:00:00.000003+00:00' }),
    sampleRow({ id: 'b', created_at: '2026-11-22T10:00:00.000002+00:00' }),
    sampleRow({ id: 'c', created_at: '2026-11-22T10:00:00.000001+00:00' }),
  ];
  const paged = harness({ query: { limit: '2' }, rows });
  await paged.controller.listAuditLogs(paged.req, paged.res);
  assert.deepEqual(paged.res.body.logs.map(log => log.id), ['a', 'b']);
  assert.equal(Buffer.from(paged.res.body.next_before, 'base64url').toString('utf8'), '2026-11-22T10:00:00.000002+00:00|b');
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

test('before ISO simple filtra solo por created_at, sin clausula de desempate', async () => {
  const h = harness({ role: 'ADMIN_TECH', query: { before: '2026-11-22T10:00:00Z' } });
  await h.controller.listAuditLogs(h.req, h.res);
  assert.equal(h.res.statusCode, 200);
  assert.ok(h.calls[0].steps.some(step => step[0] === 'lt' && step[1] === 'created_at' && step[2] === '2026-11-22T10:00:00Z'));
  assert.ok(!h.calls[0].steps.some(step => step[0] === 'or'));
});

test('paginacion estable con created_at repetido en el borde de pagina (sin saltar ni repetir filas)', async () => {
  const T_NEWER = '2026-11-22T10:00:00.000002+00:00';
  const T_TIE = '2026-11-22T10:00:00.000001+00:00';
  const T_OLDER = '2026-11-22T09:59:59.999999+00:00';
  // Orden esperado: A; luego B, C, D (mismo created_at, id desc); luego E.
  const table = [
    { ...sampleRow({ id: uid(10), created_at: T_NEWER }), event_id: EVENT },
    { ...sampleRow({ id: uid(3), created_at: T_TIE }), event_id: EVENT },
    { ...sampleRow({ id: uid(2), created_at: T_TIE }), event_id: EVENT },
    { ...sampleRow({ id: uid(1), created_at: T_TIE }), event_id: EVENT },
    { ...sampleRow({ id: uid(9), created_at: T_OLDER }), event_id: EVENT },
  ];
  const seen = [];
  const pageSizes = [];
  let before;
  for (let page = 0; page < 10; page++) {
    const h = harness({ role: 'ADMIN_TECH', query: { limit: '2', ...(before ? { before } : {}) }, evaluate: steps => evaluateSteps(steps, table) });
    await h.controller.listAuditLogs(h.req, h.res);
    assert.equal(h.res.statusCode, 200);
    pageSizes.push(h.res.body.logs.length);
    seen.push(...h.res.body.logs.map(log => log.id));
    before = h.res.body.next_before;
    if (!before) break;
  }
  assert.deepEqual(seen, [uid(10), uid(3), uid(2), uid(1), uid(9)]);
  assert.deepEqual(pageSizes, [2, 2, 1]);
});

test('cursor valido: el filtro compuesto es el mismo en ADMIN_TECH y se combina con el de acciones en ADMIN_MUN', async () => {
  const ts = '2026-11-22T10:00:00.000001+00:00';
  const cursor = encodeCursor(`${ts}|${uid(1)}`);

  const tech = harness({ role: 'ADMIN_TECH', query: { before: cursor } });
  await tech.controller.listAuditLogs(tech.req, tech.res);
  assert.equal(tech.res.statusCode, 200);
  const techOr = tech.calls[0].steps.filter(step => step[0] === 'or');
  assert.deepEqual(techOr, [['or', cursorOr(ts, uid(1))]]);
  assert.ok(!tech.calls[0].steps.some(step => step[0] === 'lt'));

  const mun = harness({ role: 'ADMIN_MUN', query: { before: cursor } });
  await mun.controller.listAuditLogs(mun.req, mun.res);
  assert.equal(mun.res.statusCode, 200);
  const munOr = mun.calls[0].steps.filter(step => step[0] === 'or');
  assert.equal(munOr.length, 2, 'filtro de acciones de cuidado y filtro de cursor');
  assert.deepEqual(munOr[1], ['or', cursorOr(ts, uid(1))]);
});

test('before con cursor invalido responde 400 sin consultar', async () => {
  const ts = '2026-11-22T10:00:00.000001+00:00';
  for (const before of [
    'no-es-cursor!',
    'ayer',
    'A'.repeat(257),
    encodeCursor('hola'),
    encodeCursor(`${ts}|${uid(1)}|extra`),
    encodeCursor(`${ts}|no-es-uuid`),
    encodeCursor(`2026-13-45T00:00:00Z|${uid(1)}`),
    encodeCursor(`${ts.replace('+00:00', '')}|${uid(1)}`),
    encodeCursor(`${ts}|${uid(1)}"),created_at.eq.x`),
  ]) {
    const h = harness({ query: { before } });
    await h.controller.listAuditLogs(h.req, h.res);
    assert.equal(h.res.statusCode, 400, before);
    assert.equal(h.calls.length, 0);
  }
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
