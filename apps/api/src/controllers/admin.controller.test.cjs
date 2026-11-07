const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
require('ts-node').register({ project: 'apps/api/tsconfig.json' });
const validation = require('../utils/admin.validation.ts');

function harness(results, service = {}) {
  const calls = [];
  const audits = [];
  const serviceCalls = [];
  const searchCalls = [];
  const participantService = Object.fromEntries(['createParticipantAccount', 'assignDelegationCode'].map(name => [name, async (...args) => {
    serviceCalls.push({ name, args });
    assert.equal(typeof service[name], 'function', `Servicio inesperado: ${name}`);
    return service[name](...args);
  }]));
  const client = { from(table) {
    const call = { table, steps: [] };
    calls.push(call);
    const result = results.shift();
    assert.ok(result, `Consulta inesperada: ${table}`);
    const query = new Proxy({}, { get(_, method) {
      if (method === 'then') return (resolve, reject) => Promise.resolve(typeof result === 'function' ? result(call) : result).then(resolve, reject);
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
    if (name === '../services/participant-account.service') return participantService;
    if (name === '../services/participant-search.service') return { async searchParticipants(...args) {
      searchCalls.push(args);
      assert.equal(typeof service.searchParticipants, 'function', 'Busqueda inesperada');
      return service.searchParticipants(...args);
    } };
    if (name === '../utils/password.utils') return require('../utils/password.utils.ts');
    if (name === '../utils/rbac.utils') return require('../utils/rbac.utils.ts');
    if (name === 'node:crypto') return require('node:crypto');
    if (name === 'bcrypt') return { hash: async () => 'hashed-password' };
    throw new Error(name);
  } });
  const res = { statusCode: 200, headers: {}, setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  return { controller: module.exports, calls, audits, serviceCalls, searchCalls, res };
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

const accountBody = () => ({
  event_id: 'event', participant_code: 'COD001', role: 'PARTICIPANT',
  first_name: 'Ana', last_name: 'Perez',
});

test('createAccount exige cada campo obligatorio sin llamar al servicio', async () => {
  for (const field of Object.keys(accountBody())) {
    const body = accountBody();
    delete body[field];
    const h = harness([]);
    await h.controller.createAccount({ body }, h.res);
    assert.equal(h.res.statusCode, 400, field);
    assert.equal(h.serviceCalls.length, 0);
    assert.equal(h.calls.length, 0);
    assert.equal(h.audits.length, 0);
  }
});

test('createAccount rechaza alias de mas de 60 caracteres', async () => {
  const h = harness([]);
  await h.controller.createAccount({ body: { ...accountBody(), alias: 'a'.repeat(61) } }, h.res);
  assert.equal(h.res.statusCode, 400);
  assert.match(h.res.body.error, /alias/);
  assert.equal(h.serviceCalls.length, 0);
  assert.equal(h.calls.length, 0);
});

test('createAccount propaga el status y error del servicio sin auditar exito', async () => {
  const h = harness([], { createParticipantAccount: async () => ({ ok: false, status: 409, error: 'Codigo duplicado' }) });
  await h.controller.createAccount({ body: accountBody() }, h.res);
  assert.equal(h.res.statusCode, 409);
  assert.equal(h.res.body.error, 'Codigo duplicado');
  assert.equal(h.serviceCalls.length, 1);
  assert.equal(h.audits.length, 0);
});

test('createAccount devuelve credenciales, codigo y warnings sin cache y audita el alta', async () => {
  const result = {
    ok: true, user: { id: 'u1' }, membership: { id: 'm1' }, profile: { first_name: 'Ana' },
    initialPassword: 'Temporal-123', delegationCode: '#001', warnings: ['Aviso del servicio'],
  };
  const h = harness([], { createParticipantAccount: async () => result });
  const actor = { id: 'admin-membership', eventId: 'event', role: 'ADMIN' };
  await h.controller.createAccount({ body: { ...accountBody(), alias: '  Ana  ' }, auth: { userId: 'admin-user', currentMembership: actor } }, h.res);
  assert.equal(h.res.statusCode, 200);
  assert.equal(h.res.headers['cache-control'], 'no-store');
  assert.equal(h.res.body.initial_password, result.initialPassword);
  assert.equal(h.res.body.delegation_code, '#001');
  assert.deepEqual(h.res.body.warnings, result.warnings);
  assert.equal(h.res.body.membership.id, 'm1');
  assert.equal(h.serviceCalls.length, 1);
  assert.equal(h.serviceCalls[0].args[0].alias, 'Ana');
  assert.equal(h.serviceCalls[0].args[0].participant_code, 'COD001');
  assert.equal(h.serviceCalls[0].args[1], 'admin-user');
  assert.equal(h.calls.length, 0);
  assert.equal(h.audits.length, 1);
  const audit = h.audits[0];
  assert.equal(audit.actionType, 'CREATE_ACCOUNT');
  assert.equal(audit.entityId, 'm1');
  assert.equal(audit.eventId, 'event');
  assert.equal(audit.outcome, 'SUCCESS');
  assert.equal(audit.membership, actor);
  assert.equal(audit.actorUserId, 'admin-user');
});

for (const assignment of [{ code: '#002', error: null }, { code: null, error: 'RPC no disponible' }]) {
  test(`createMembership devuelve 200 con codigo ${assignment.code} y warnings correspondientes`, async () => {
    const h = harness([
      { data: { id: 'event' } }, { data: { id: 'u1' } }, { data: null }, { data: { id: 'm1' } },
    ], { assignDelegationCode: async () => assignment });
    await h.controller.createMembership({ body: { ...accountBody(), user_id: 'u1' } }, h.res);
    assert.equal(h.res.statusCode, 200);
    assert.equal(h.res.body.membership.delegation_code, assignment.code);
    assert.equal(h.res.body.warnings.length, assignment.error ? 1 : 0);
    if (assignment.error) assert.match(h.res.body.warnings[0], /no se pudo asignar/);
    assert.deepEqual(h.serviceCalls, [{ name: 'assignDelegationCode', args: ['m1'] }]);
    assert.equal(h.audits[0].actionType, 'CREATE_MEMBERSHIP');
  });
}

test('updateParticipant rechaza alias largo antes de consultar', async () => {
  const h = harness([]);
  await h.controller.updateParticipant({ params: { membershipId: 'm1' }, body: { alias: 'a'.repeat(61) } }, h.res);
  assert.equal(h.res.statusCode, 400);
  assert.match(h.res.body.error, /alias/);
  assert.equal(h.calls.length, 0);
  assert.equal(h.audits.length, 0);
});

test('updateParticipant acepta alias de 60 caracteres y recorta espacios', async () => {
  const alias = 'a'.repeat(60);
  const h = harness([{ data: { id: 'm1', event_id: 'event' } }, { data: null }]);
  await h.controller.updateParticipant({ params: { membershipId: 'm1' }, body: { alias: `  ${alias}  ` } }, h.res);
  assert.equal(h.res.statusCode, 200);
  assert.equal(h.calls[1].table, 'profiles');
  assert.equal(h.calls[1].steps.find(step => step[0] === 'update')[1].alias, alias);
  assert.deepEqual(h.calls[1].steps.find(step => step[0] === 'eq'), ['eq', 'event_membership_id', 'm1']);
  assert.equal(h.audits[0].actionType, 'UPDATE_PARTICIPANT');
});

test('listParticipants delega q recortado, paginacion y filtros y devuelve el body intacto', async () => {
  const body = { participants: [{ id: 'm1' }], pagination: { page: 2, limit: 10, total: 11, total_pages: 2 } };
  const h = harness([() => assert.fail('No debe ejecutar la consulta sin busqueda')], {
    searchParticipants: async () => ({ body }),
  });
  await h.controller.listParticipants({ query: {
    event_id: 'event', q: '  Ana Pérez  ', page: '2', limit: '10',
    committee_id: 'c1', role: 'PARTICIPANT', status: 'ACTIVE',
  } }, h.res);
  assert.equal(h.res.statusCode, 200);
  assert.equal(h.res.body, body);
  assert.deepEqual(JSON.parse(JSON.stringify(h.searchCalls)), [[{
    eventId: 'event', q: 'Ana Pérez', page: 2, limit: 10,
    filters: { committeeId: 'c1', role: 'PARTICIPANT', status: 'ACTIVE' },
  }]]);
});

test('listParticipants devuelve 400 con el error del servicio de busqueda', async () => {
  const h = harness([() => assert.fail('No debe ejecutar la consulta sin busqueda')], {
    searchParticipants: async () => ({ error: 'No se pudieron consultar los perfiles' }),
  });
  await h.controller.listParticipants({ query: { event_id: 'event', q: 'Ana' } }, h.res);
  assert.equal(h.res.statusCode, 400);
  assert.equal(h.res.body.error, 'No se pudieron consultar los perfiles');
  assert.deepEqual(JSON.parse(JSON.stringify(h.searchCalls)), [[{
    eventId: 'event', q: 'Ana', page: 1, limit: 20,
    filters: { committeeId: null, role: null, status: null },
  }]]);
});

test('listParticipants sin q o con espacios no llama al servicio de busqueda', async () => {
  for (const query of [{ event_id: 'event' }, { event_id: 'event', q: '   ' }]) {
    const h = harness([{ data: [{ id: 'm1' }], count: 1 }, { data: [{ event_membership_id: 'm1', first_name: 'Ana' }] }]);
    await h.controller.listParticipants({ query }, h.res);
    assert.equal(h.res.statusCode, 200);
    assert.equal(h.searchCalls.length, 0);
    assert.equal(h.res.body.participants[0].profile.first_name, 'Ana');
    assert.equal(h.res.body.pagination.total, 1);
    assert.deepEqual(h.calls[0].steps.find(step => step[0] === 'range'), ['range', 0, 19]);
  }
});

test('updateParticipant rechaza un comite archivado igual que la ruta dedicada', async () => {
  const h = harness([
    { data: { id: 'm1', event_id: 'event' } },
    { data: { id: 'archived', event_id: 'event', status: 'ARCHIVED' } },
  ]);
  await h.controller.updateParticipant({ params: { membershipId: 'm1' }, body: { committee_id: 'archived' } }, h.res);
  assert.equal(h.res.statusCode, 400);
  assert.equal(h.res.body.error, 'El comite esta archivado');
  assert.equal(h.calls.length, 2);
  assert.equal(h.audits.length, 0);
  assert.equal(h.calls.some(call => call.steps.some(step => step[0] === 'update')), false);
});
