const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
require('ts-node').register({ project: 'apps/api/tsconfig.json' });
const validation = require('../utils/admin.validation.ts');

function harness(results) {
  const calls = [];
  const audits = [];
  const client = { from(table) {
    const call = { table, steps: [] };
    calls.push(call);
    const result = results.shift();
    assert.ok(result, `Consulta inesperada: ${table}`);
    const query = new Proxy({}, { get(_, method) {
      if (method === 'then') return (resolve, reject) => Promise.resolve(result).then(resolve, reject);
      return (...args) => { call.steps.push([method, ...args]); return query; };
    } });
    return query;
  } };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(__dirname + '/admin.controller.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports: module.exports, module, console, require(name) {
    if (name === '../lib/supabase') return { supabaseAdmin: client };
    if (name === '../utils/audit.logger') return { logAudit: async value => audits.push(value) };
    if (name === '../utils/admin.validation') return validation;
    if (name === '../utils/password.utils') return require('../utils/password.utils.ts');
    if (name === '../utils/rbac.utils') return require('../utils/rbac.utils.ts');
    if (name === 'node:crypto') return require('node:crypto');
    if (name === 'bcrypt') return { hash: async () => 'hashed-password' };
    throw new Error(name);
  } });
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  return { controller: module.exports, calls, audits, res };
}

test('lista eventos con paginación estable y conteo', async () => {
  const h = harness([{ data: [{ id: 'event' }], count: 45 }]);
  const req = {
    query: { page: '2', limit: '20' },
    auth: { memberships: [{ eventId: 'event', role: 'ADMIN', accountStatus: 'ACTIVE' }] },
  };
  await h.controller.listEvents(req, h.res);
  assert.equal(h.res.body.pagination.total_pages, 3);
  assert.deepEqual(h.calls[0].steps.find(step => step[0] === 'range'), ['range', 20, 39]);
});
test('no consulta ni filtra eventos si no hay membership admin', async () => {
  const h = harness([]);
  await h.controller.listEvents({ query: {}, auth: { memberships: [] } }, h.res);
  assert.equal(h.calls.length, 0);
  assert.equal(h.res.body.events.length, 0);
});
test('rechaza paginación inválida antes de consultar', async () => {
  const h = harness([]);
  await h.controller.listEvents({ query: { page: '0' } }, h.res);
  assert.equal(h.res.statusCode, 400);
});
test('valida fechas de PATCH contra la fecha guardada', async () => {
  const h = harness([{ data: { id: 'event', start_date: '2026-10-10', end_date: '2026-10-12' } }]);
  await h.controller.updateEvent({ params: { eventId: 'event' }, body: { start_date: '2026-10-13' } }, h.res);
  assert.equal(h.res.statusCode, 400);
  assert.equal(h.calls.length, 1);
});
test('error de consulta no se reporta como registro inexistente', async () => {
  const h = harness([{ error: { message: 'offline' } }]);
  await h.controller.updateCommittee({ params: { committeeId: 'committee' }, body: { name: 'CSNU' } }, h.res);
  assert.equal(h.res.statusCode, 500);
});
test('no reporta éxito ni audita éxito si falla sincronización del muro', async () => {
  const h = harness([
    { data: { id: 'committee', event_id: 'event' } },
    { data: null },
    { data: { id: 'committee', name: 'CSNU' } },
    { error: { message: 'offline' } },
  ]);
  await h.controller.updateCommittee({ params: { committeeId: 'committee' }, body: { name: 'CSNU' } }, h.res);
  assert.equal(h.res.statusCode, 500);
  assert.equal(h.audits.length, 0);
});
test('crea comité y muro antes de auditar éxito', async () => {
  const h = harness([
    { data: { id: 'event', status: 'ACTIVE' } }, { data: null }, { data: null },
    { data: { id: 'committee' } }, { data: { id: 'wall' } },
  ]);
  await h.controller.createCommittee({ body: { event_id: 'event', name: 'CSNU', code: 'CSNU' } }, h.res);
  assert.equal(h.res.statusCode, 200);
  assert.equal(h.res.body.wall.id, 'wall');
  assert.equal(h.audits[0].actionType, 'CREATE_COMMITTEE');
  assert.equal(h.calls[4].steps[0][1].committee_id, 'committee');
});

test('lista participantes exige event_id antes de consultar', async () => {
  const h = harness([]);
  await h.controller.listParticipants({ query: {} }, h.res);
  assert.equal(h.res.statusCode, 400);
  assert.equal(h.calls.length, 0);
});

test('actualizar participante rechaza body sin campos editables', async () => {
  const h = harness([]);
  await h.controller.updateParticipant({ params: { membershipId: 'm1' }, body: {} }, h.res);
  assert.equal(h.res.statusCode, 400);
  assert.equal(h.calls.length, 0);
});

test('suspender exige motivo antes de consultar', async () => {
  const h = harness([]);
  await h.controller.suspendParticipant({ params: { membershipId: 'm1' }, body: {} }, h.res);
  assert.equal(h.res.statusCode, 400);
  assert.equal(h.calls.length, 0);
});

test('suspende cuenta activa y audita con el motivo dado', async () => {
  const h = harness([
    { data: { id: 'm1', event_id: 'event', account_status: 'ACTIVE' } },
    { data: { id: 'm1', account_status: 'SUSPENDED' } },
  ]);
  await h.controller.suspendParticipant(
    { params: { membershipId: 'm1' }, body: { reason: 'Conducta inapropiada' } },
    h.res
  );
  assert.equal(h.res.statusCode, 200);
  assert.equal(h.audits[0].actionType, 'SUSPEND_ACCOUNT');
  assert.equal(h.audits[0].reason, 'Conducta inapropiada');
});

test('no suspende una cuenta que ya esta suspendida', async () => {
  const h = harness([{ data: { id: 'm1', event_id: 'event', account_status: 'SUSPENDED' } }]);
  await h.controller.suspendParticipant(
    { params: { membershipId: 'm1' }, body: { reason: 'motivo' } },
    h.res
  );
  assert.equal(h.res.statusCode, 400);
  assert.equal(h.audits.length, 0);
});

test('no reactiva una cuenta que no esta suspendida', async () => {
  const h = harness([{ data: { id: 'm1', event_id: 'event', account_status: 'ACTIVE' } }]);
  await h.controller.reactivateParticipant(
    { params: { membershipId: 'm1' }, body: { reason: 'motivo' } },
    h.res
  );
  assert.equal(h.res.statusCode, 400);
  assert.equal(h.audits.length, 0);
});

test('restablece la contrasena inicial si la cuenta esta pendiente de activacion', async () => {
  const h = harness([
    { data: { id: 'm1', event_id: 'event', user_id: 'u1', account_status: 'PENDING_ACTIVATION', participant_code: 'C1' } },
    { data: null },
  ]);
  await h.controller.resetParticipantPassword({ params: { membershipId: 'm1' } }, h.res);
  assert.equal(h.res.statusCode, 200);
  assert.ok(h.res.body.temporary_password);
  assert.equal(h.audits[0].actionType, 'RESET_PASSWORD');
});

test('no restablece la contrasena de una cuenta suspendida', async () => {
  const h = harness([
    { data: { id: 'm1', event_id: 'event', user_id: 'u1', account_status: 'SUSPENDED', participant_code: 'C1' } },
  ]);
  await h.controller.resetParticipantPassword({ params: { membershipId: 'm1' } }, h.res);
  assert.equal(h.res.statusCode, 400);
  assert.equal(h.audits.length, 0);
});
