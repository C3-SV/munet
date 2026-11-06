const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function compile(file) {
  return ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
}

// Las utilidades puras se ejecutan localmente; los stubs registran sus argumentos.
const utilsModule = { exports: {} };
vm.runInNewContext(compile(__dirname + '/../utils/participant-import.utils.ts'), {
  module: utilsModule, exports: utilsModule.exports,
});
const utils = utilsModule.exports;
const controllerCode = compile(__dirname + '/admin-participants.controller.ts');
const plain = value => JSON.parse(JSON.stringify(value));

function harness(results = [], overrides = {}) {
  const pending = [...results];
  const calls = [];
  const audits = [];
  const serviceCalls = [];
  const utilsCalls = [];
  const unexpected = [];
  const logs = [];
  const client = { from(table) {
    const call = { table, steps: [] };
    calls.push(call);
    const result = pending.shift();
    if (!result) unexpected.push(table);
    assert.ok(result, `Consulta inesperada: ${table}`);
    const query = new Proxy({}, { get(_, method) {
      if (method === 'then') return (resolve, reject) => Promise.resolve(result).then(resolve, reject);
      return (...args) => { call.steps.push([method, ...args]); return query; };
    } });
    return query;
  } };
  const utilsStub = { ...utils };
  for (const name of ['buildImportPreview', 'validateConfirmRows']) {
    utilsStub[name] = (...args) => {
      utilsCalls.push({ name, args });
      return (overrides[name] ?? utils[name])(...args);
    };
  }
  const module = { exports: {} };
  vm.runInNewContext(controllerCode, { module, exports: module.exports,
    console: { error: (...args) => logs.push(args) }, require(name) {
      if (name === '../lib/supabase') return { supabaseAdmin: client };
      if (name === '../utils/audit.logger') return { logAudit: async value => audits.push(value) };
      if (name === '../utils/participant-import.utils') return utilsStub;
      if (name === '../services/participant-account.service') return { async createParticipantAccount(...args) {
        serviceCalls.push(args);
        assert.equal(typeof overrides.createParticipantAccount, 'function', 'Alta inesperada');
        return overrides.createParticipantAccount(...args);
      } };
      throw new Error(`Import inesperado: ${name}`);
    },
  });
  const res = {
    statusCode: 200, headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  return { controller: module.exports, res, calls, audits, serviceCalls, utilsCalls, logs,
    done() { assert.deepEqual(unexpected, []); assert.equal(pending.length, 0, 'Consultas pendientes'); },
  };
}

const actor = { id: 'admin-membership', eventId: 'event', role: 'ADMIN' };
const request = body => ({ body: { event_id: 'event', ...body }, auth: { userId: 'admin-user', currentMembership: actor } });
const contextResults = () => [{ data: { id: 'event', status: 'ACTIVE' } }, { data: [] }, { data: [] }];
const importRow = row => ({
  row, first_name: 'Ana', last_name: 'Perez', participant_code: `COD${row}`,
  role: 'PARTICIPANT', committee_id: null, committee_label: null,
  alias: null, delegation_name: null, institution_name: null,
});
const success = input => ({
  ok: true, user: { id: `u-${input.participant_code}` }, membership: { id: `m-${input.participant_code}` },
  profile: {}, initialPassword: `Temporal-${input.participant_code}`, delegationCode: '#001', warnings: [],
});

test('previewParticipantImport rechaza csv ausente, vacio o no textual sin consultar', async () => {
  for (const csv of [undefined, '', '  ', 123]) {
    const h = harness();
    await h.controller.previewParticipantImport(request({ csv }), h.res);
    assert.equal(h.res.statusCode, 400);
    assert.match(h.res.body.error, /csv/);
    assert.equal(h.utilsCalls.length, 0);
    h.done();
  }
});

test('previewParticipantImport devuelve 413 por encima de 2000000 caracteres', async () => {
  const h = harness();
  await h.controller.previewParticipantImport(request({ csv: 'a'.repeat(2_000_001) }), h.res);
  assert.equal(h.res.statusCode, 413);
  assert.equal(h.utilsCalls.length, 0);
  h.done();
});

test('previewParticipantImport devuelve 404 si el evento no existe', async () => {
  const h = harness([{ data: null }]);
  await h.controller.previewParticipantImport(request({ csv: 'nombre,apellido,codigo_participante' }), h.res);
  assert.equal(h.res.statusCode, 404);
  assert.equal(h.calls[0].table, 'events');
  assert.equal(h.utilsCalls.length, 0);
  h.done();
});

test('previewParticipantImport pagina tras exactamente 1000 codigos y devuelve encabezados y limites', async () => {
  const firstPage = Array.from({ length: 1000 }, (_, index) => ({ participant_code: `COD${index}` }));
  const h = harness([
    { data: { id: 'event' } }, { data: [] }, { data: firstPage }, { data: [{ participant_code: 'ULTIMO' }] },
  ]);
  const csv = 'nombre,apellido,codigo_participante\nAna,Perez,ULTIMO\nLuis,Perez,NUEVO';
  await h.controller.previewParticipantImport(request({ csv }), h.res);
  assert.equal(h.res.statusCode, 200);
  assert.deepEqual(plain(h.res.body.template_headers), ['nombre', 'apellido', 'codigo_participante', 'comite', 'delegacion', 'rol', 'alias']);
  assert.deepEqual(plain(h.res.body.limits), { max_rows: 1000, confirm_batch_max: 50 });
  assert.equal(h.res.body.duplicates[0].participant_code, 'ULTIMO');
  assert.equal(h.res.body.duplicates[0].reason, 'IN_EVENT');
  assert.equal(h.res.body.valid[0].participant_code, 'NUEVO');
  assert.equal(h.utilsCalls[0].args[1].existingParticipantCodes.length, 1001);
  for (const [index, from] of [[2, 0], [3, 1000]]) {
    assert.equal(h.calls[index].table, 'event_memberships');
    assert.deepEqual(h.calls[index].steps.find(step => step[0] === 'range'), ['range', from, from + 999]);
    assert.deepEqual(h.calls[index].steps.find(step => step[0] === 'eq'), ['eq', 'event_id', 'event']);
    assert.deepEqual(h.calls[index].steps.find(step => step[0] === 'is'), ['is', 'deleted_at', null]);
    assert.deepEqual(plain(h.calls[index].steps.find(step => step[0] === 'order')), ['order', 'id', { ascending: true }]);
  }
  assert.equal(h.serviceCalls.length, 0);
  assert.equal(h.audits.length, 0);
  h.done();
});

test('previewParticipantImport termina con pagina vacia despues de 1000 codigos', async () => {
  const h = harness([
    { data: { id: 'event' } }, { data: [] },
    { data: Array.from({ length: 1000 }, (_, index) => ({ participant_code: `COD${index}` })) }, { data: [] },
  ]);
  await h.controller.previewParticipantImport(request({ csv: 'nombre,apellido,codigo_participante\nAna,Perez,NUEVO' }), h.res);
  assert.equal(h.res.statusCode, 200);
  assert.equal(h.res.body.valid.length, 1);
  assert.equal(h.calls.length, 4);
  h.done();
});

test('confirmParticipantImport rechaza mas de 50 filas sin crear cuentas', async () => {
  const h = harness(contextResults());
  await h.controller.confirmParticipantImport(request({ rows: Array.from({ length: 51 }, (_, i) => importRow(i + 2)) }), h.res);
  assert.equal(h.res.statusCode, 400);
  assert.match(h.res.body.error, /50/);
  assert.equal(h.serviceCalls.length, 0);
  assert.equal(h.audits.length, 0);
  assert.equal(h.res.headers['cache-control'], 'no-store');
  h.done();
});

test('confirmParticipantImport crea solo filas validas, continua tras ok:false y ordena resultados y auditoria', async () => {
  const completed = [];
  let releaseFirst;
  const gate = new Promise(resolve => { releaseFirst = resolve; });
  const h = harness(contextResults(), { async createParticipantAccount(input, actorUserId, options) {
    assert.equal(input.event_id, 'event');
    assert.equal(actorUserId, 'admin-user');
    assert.equal(options.skipCodeCheck, true);
    if (input.participant_code === 'COD8') await gate;
    if (input.participant_code === 'COD2') releaseFirst();
    completed.push(input.participant_code);
    if (input.participant_code === 'COD4') return { ok: false, status: 409, error: 'Codigo ocupado' };
    return success(input);
  } });
  const rows = [importRow(8), { ...importRow(7), first_name: '' }, importRow(4), importRow(2),
    { ...importRow(3), role: 'ADMIN' }, importRow(6), importRow(9), importRow(10)];
  await h.controller.confirmParticipantImport(request({ rows }), h.res);
  assert.equal(h.res.statusCode, 200);
  assert.equal(h.res.headers['cache-control'], 'no-store');
  assert.deepEqual(plain(h.res.body.summary), { requested: 8, created: 5, failed: 3 });
  assert.deepEqual(plain(h.res.body.created.map(item => item.row)), [2, 6, 8, 9, 10]);
  assert.deepEqual(plain(h.res.body.failed.map(item => item.row)), [3, 4, 7]);
  assert.deepEqual(plain(h.res.body.failed.find(item => item.row === 4).errors), ['Codigo ocupado']);
  assert.deepEqual(h.serviceCalls.map(args => args[0].participant_code).sort(), ['COD10', 'COD2', 'COD4', 'COD6', 'COD8', 'COD9']);
  assert.ok(completed.indexOf('COD2') < completed.indexOf('COD8'), 'Las altas terminan fuera del orden de entrada');
  for (const item of h.res.body.created) {
    assert.equal(item.initial_password, `Temporal-COD${item.row}`);
    assert.equal(item.membership_id, `m-COD${item.row}`);
    assert.equal(item.delegation_code, '#001');
    const audit = h.audits.find(entry => entry.entityId === item.membership_id);
    assert.equal(audit.actionType, 'CREATE_ACCOUNT');
    assert.equal(audit.outcome, 'SUCCESS');
    assert.equal(audit.eventId, 'event');
    assert.equal(audit.actorUserId, 'admin-user');
    assert.equal(audit.membership, actor);
    assert.match(audit.reason, new RegExp(`fila ${item.row}`));
  }
  assert.equal(h.audits.length, 6);
  const lastAudit = h.audits.at(-1);
  assert.equal(lastAudit.actionType, 'IMPORT_PARTICIPANTS');
  assert.equal(lastAudit.outcome, 'FAILURE');
  assert.equal(lastAudit.entityId, 'event');
  assert.match(lastAudit.reason, /5 creadas, 3 fallidas/);
  h.done();
});

test('confirmParticipantImport audita SUCCESS si todas las filas se crean', async () => {
  const h = harness(contextResults(), { createParticipantAccount: async input => success(input) });
  await h.controller.confirmParticipantImport(request({ rows: [importRow(2)] }), h.res);
  assert.equal(h.res.statusCode, 200);
  assert.equal(h.res.body.created[0].initial_password, 'Temporal-COD2');
  assert.equal(h.res.body.failed.length, 0);
  assert.equal(h.audits.at(-1).actionType, 'IMPORT_PARTICIPANTS');
  assert.equal(h.audits.at(-1).outcome, 'SUCCESS');
  h.done();
});

test('confirmParticipantImport aisla excepciones por fila y conserva credenciales de las altas exitosas', async () => {
  const completed = [];
  const h = harness(contextResults(), { async createParticipantAccount(input) {
    if (input.participant_code === 'COD2') throw new Error('Fallo inesperado del servicio');
    completed.push(input.participant_code);
    return success(input);
  } });
  // Ocho filas superan los cinco workers y comprueban que la cola sigue avanzando.
  const rows = Array.from({ length: 8 }, (_, index) => importRow(index + 2));
  await h.controller.confirmParticipantImport(request({ rows }), h.res);
  assert.deepEqual(completed.sort(), ['COD3', 'COD4', 'COD5', 'COD6', 'COD7', 'COD8', 'COD9']);
  h.done();
  assert.equal(h.res.statusCode, 200);
  assert.equal(h.res.headers['cache-control'], 'no-store');
  assert.deepEqual(plain(h.res.body.summary), { requested: 8, created: 7, failed: 1 });
  assert.deepEqual(plain(h.res.body.created.map(item => item.row)), [3, 4, 5, 6, 7, 8, 9]);
  for (const item of h.res.body.created) {
    assert.equal(item.initial_password, `Temporal-COD${item.row}`);
    assert.equal(item.membership_id, `m-COD${item.row}`);
  }
  assert.deepEqual(plain(h.res.body.failed), [{ row: 2, participant_code: 'COD2',
    errors: ['Error interno al crear la cuenta. Revisa si quedo creada antes de reintentar.'],
  }]);
  assert.equal(h.serviceCalls.length, 8);
  assert.equal(h.audits.filter(entry => entry.actionType === 'CREATE_ACCOUNT').length, 7);
  assert.equal(h.audits.at(-1).actionType, 'IMPORT_PARTICIPANTS');
  assert.equal(h.audits.at(-1).outcome, 'FAILURE');
});

const currentMembership = () => ({ data: { id: 'm1', event_id: 'event', committee_id: 'old' } });
const committeeRequest = body => ({ ...request(body), params: { membershipId: 'm1' } });

test('changeParticipantCommittee exige committee_id antes de consultar', async () => {
  const h = harness();
  await h.controller.changeParticipantCommittee(committeeRequest({}), h.res);
  assert.equal(h.res.statusCode, 400);
  assert.match(h.res.body.error, /committee_id/);
  assert.equal(h.audits.length, 0);
  h.done();
});

test('changeParticipantCommittee rechaza el mismo comite sin actualizar', async () => {
  const h = harness([currentMembership()]);
  await h.controller.changeParticipantCommittee(committeeRequest({ committee_id: 'old' }), h.res);
  assert.equal(h.res.statusCode, 400);
  assert.match(h.res.body.error, /ya esta/);
  assert.equal(h.audits.length, 0);
  h.done();
});

for (const scenario of [
  { name: 'inexistente', data: null, status: 404, error: /no encontrado/ },
  { name: 'de otro evento', data: { id: 'new', event_id: 'other', status: 'ACTIVE' }, status: 400, error: /no pertenece/ },
  { name: 'archivado', data: { id: 'new', event_id: 'event', status: 'ARCHIVED' }, status: 400, error: /archivado/ },
]) {
  test(`changeParticipantCommittee rechaza comite ${scenario.name}`, async () => {
    const h = harness([currentMembership(), { data: scenario.data }]);
    await h.controller.changeParticipantCommittee(committeeRequest({ committee_id: 'new' }), h.res);
    assert.equal(h.res.statusCode, scenario.status);
    assert.match(h.res.body.error, scenario.error);
    assert.equal(h.audits.length, 0);
    assert.equal(h.calls.some(call => call.steps.some(step => step[0] === 'update')), false);
    h.done();
  });
}

for (const committeeId of [null, 'new']) {
  test(`changeParticipantCommittee cambia old a ${committeeId} y audita ambos comites`, async () => {
    const results = [currentMembership()];
    if (committeeId) results.push({ data: { id: 'new', name: 'CSNU', event_id: 'event', status: 'ACTIVE' } });
    results.push({ data: { id: 'm1', event_id: 'event', committee_id: committeeId } });
    const h = harness(results);
    await h.controller.changeParticipantCommittee(committeeRequest({ committee_id: committeeId, reason: '  Reasignacion  ' }), h.res);
    assert.equal(h.res.statusCode, 200);
    assert.equal(h.res.body.membership.committee_id, committeeId);
    assert.deepEqual(plain(h.res.body.committee), committeeId ? { id: 'new', name: 'CSNU' } : null);
    const update = h.calls.at(-1);
    assert.equal(update.table, 'event_memberships');
    assert.deepEqual(plain(update.steps.find(step => step[0] === 'update')),
      ['update', { committee_id: committeeId, updated_by_user_id: 'admin-user' }]);
    assert.deepEqual(update.steps.find(step => step[0] === 'eq'), ['eq', 'id', 'm1']);
    assert.equal(h.audits.length, 1);
    assert.equal(h.audits[0].actionType, 'CHANGE_COMMITTEE');
    assert.equal(h.audits[0].reason, `Comite old -> ${committeeId ?? 'ninguno'}. Motivo: Reasignacion`);
    assert.equal(h.audits[0].entityId, 'm1');
    assert.equal(h.audits[0].eventId, 'event');
    assert.equal(h.audits[0].outcome, 'SUCCESS');
    assert.equal(h.audits[0].membership, actor);
    h.done();
  });
}
