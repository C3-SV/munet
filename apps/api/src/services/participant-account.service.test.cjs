const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const code = ts.transpileModule(fs.readFileSync(__dirname + '/participant-account.service.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;
const plain = value => JSON.parse(JSON.stringify(value));
const password = 'Temporal-Servidor-123';
const passwordHash = 'hash-simulado-no-reversible';
const input = () => ({
  event_id: 'event', participant_code: 'COD001', role: 'PARTICIPANT',
  first_name: 'Ana', last_name: 'Perez', alias: 'Ana',
});

function harness(results = [], options = {}) {
  const pending = [...results];
  const calls = [];
  const rpcCalls = [];
  const hashCalls = [];
  const logs = [];
  const unexpected = [];
  let generated = 0;
  const client = {
    from(table) {
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
    },
    async rpc(...args) {
      rpcCalls.push(args);
      assert.ok(Object.hasOwn(options, 'rpcResult'), 'RPC inesperada');
      return options.rpcResult;
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports,
    console: { error: (...args) => logs.push(args) }, require(name) {
      if (name === '../lib/supabase') return { supabaseAdmin: client };
      if (name === '../utils/password.utils') return { generateInitialPassword() { generated++; return password; } };
      if (name === 'bcrypt') return { async hash(...args) {
        hashCalls.push(args);
        if (options.hashError) throw options.hashError;
        return passwordHash;
      } };
      throw new Error(`Import inesperado: ${name}`);
    },
  });
  return { service: module.exports, calls, rpcCalls, hashCalls, logs, get generated() { return generated; },
    done() { assert.deepEqual(unexpected, []); assert.equal(pending.length, 0, 'Consultas pendientes'); },
  };
}

const successResults = () => [
  { data: null }, { data: { id: 'u1' } }, { data: { id: 'm1' } }, { data: { id: 'p1' } },
];

test('codigo existente devuelve 409 sin insertar ni generar credenciales', async () => {
  const h = harness([{ data: { id: 'existing' } }]);
  const result = await h.service.createParticipantAccount(input(), 'admin-user');
  assert.equal(result.ok, false);
  assert.equal(result.status, 409);
  assert.match(result.error, /participant_code/);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].table, 'event_memberships');
  assert.deepEqual(h.calls[0].steps.filter(step => step[0] === 'eq'),
    [['eq', 'participant_code', 'COD001'], ['eq', 'event_id', 'event']]);
  assert.equal(h.calls[0].steps.some(step => step[0] === 'insert'), false);
  assert.equal(h.generated, 0);
  assert.equal(h.hashCalls.length, 0);
  assert.equal(h.rpcCalls.length, 0);
  h.done();
});

for (const committee of [
  { id: 'c1', event_id: 'event', status: 'ARCHIVED' },
  { id: 'c1', event_id: 'other', status: 'ACTIVE' },
]) {
  for (const cached of [false, true]) {
    test(`rechaza comite ${committee.status === 'ARCHIVED' ? 'archivado' : 'ajeno'} antes de insertar, precargado=${cached}`, async () => {
      const results = [{ data: null }];
      if (!cached) results.push({ data: committee });
      const h = harness(results);
      const result = await h.service.createParticipantAccount({ ...input(), committee_id: 'c1' }, 'admin-user',
        cached ? { committee } : undefined);
      assert.equal(result.ok, false);
      assert.equal(result.status, 400);
      assert.match(result.error, committee.status === 'ARCHIVED' ? /archivado/ : /no pertenece/);
      assert.equal(h.calls.some(call => call.steps.some(step => step[0] === 'insert')), false);
      assert.equal(h.generated, 0);
      assert.equal(h.rpcCalls.length, 0);
      h.done();
    });
  }
}

for (const error of [
  { code: '23505', message: 'Restriccion unica' },
  { code: '23503', message: 'Referencia inexistente' },
]) {
  test(`fallo ${error.code} de membership borra user y devuelve ${error.code === '23505' ? 409 : 400}`, async () => {
    const h = harness([{ data: null }, { data: { id: 'u1' } }, { error }, { data: null }]);
    const result = await h.service.createParticipantAccount(input(), 'admin-user');
    assert.equal(result.ok, false);
    assert.equal(result.status, error.code === '23505' ? 409 : 400);
    assert.equal(h.calls[2].table, 'event_memberships');
    assert.equal(h.calls[2].steps[0][0], 'insert');
    assert.equal(h.calls[3].table, 'users');
    assert.deepEqual(h.calls[3].steps, [['delete'], ['eq', 'id', 'u1']]);
    assert.equal(h.calls.some(call => call.table === 'profiles'), false);
    assert.equal(h.rpcCalls.length, 0);
    h.done();
  });
}

test('fallo al insertar perfil borra primero membership y despues user', async () => {
  const h = harness([
    { data: null }, { data: { id: 'u1' } }, { data: { id: 'm1' } },
    { error: { message: 'Perfil invalido' } }, { data: null }, { data: null },
  ]);
  const result = await h.service.createParticipantAccount(input(), 'admin-user');
  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
  assert.equal(result.error, 'Perfil invalido');
  assert.equal(h.calls[3].table, 'profiles');
  assert.equal(h.calls[3].steps[0][0], 'insert');
  assert.deepEqual(h.calls.slice(4), [
    { table: 'event_memberships', steps: [['delete'], ['eq', 'id', 'm1']] },
    { table: 'users', steps: [['delete'], ['eq', 'id', 'u1']] },
  ]);
  assert.equal(h.rpcCalls.length, 0);
  h.done();
});

test('fallo de assign_delegation_code conserva cuenta y devuelve warning sin codigo', async () => {
  const h = harness(successResults(), { rpcResult: { data: null, error: { message: 'Funcion no disponible' } } });
  const result = await h.service.createParticipantAccount(input(), 'admin-user');
  assert.equal(result.ok, true);
  assert.equal(result.delegationCode, null);
  assert.equal(result.membership.delegation_code, null);
  assert.equal(result.initialPassword, password);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /no se pudo asignar el codigo/);
  assert.equal(h.calls.some(call => call.steps.some(step => step[0] === 'delete')), false);
  assert.deepEqual(plain(h.rpcCalls), [['assign_delegation_code', { p_membership_id: 'm1' }]]);
  h.done();
});

test('alta exitosa asigna codigo con membership_id y guarda solo hash de la contrasena generada', async () => {
  const h = harness(successResults(), { rpcResult: { data: '#007', error: null } });
  const result = await h.service.createParticipantAccount(input(), 'admin-user');
  assert.equal(result.ok, true);
  assert.equal(result.initialPassword, password);
  assert.equal(result.delegationCode, '#007');
  assert.equal(result.membership.delegation_code, '#007');
  assert.equal(result.profile.id, 'p1');
  assert.equal(result.warnings.length, 0);
  assert.equal(h.generated, 1);
  assert.deepEqual(h.hashCalls, [[password, 10]]);
  assert.deepEqual(plain(h.rpcCalls), [['assign_delegation_code', { p_membership_id: 'm1' }]]);
  const inserts = h.calls.filter(call => call.steps.some(step => step[0] === 'insert'));
  assert.deepEqual(inserts.map(call => call.table), ['users', 'event_memberships', 'profiles']);
  const membership = inserts[1].steps.find(step => step[0] === 'insert')[1];
  assert.equal(membership.initial_password_hash, passwordHash);
  assert.equal(Object.hasOwn(membership, 'initial_password'), false);
  assert.equal(membership.account_status, 'PENDING_ACTIVATION');
  assert.equal(membership.event_id, 'event');
  assert.equal(membership.user_id, 'u1');
  assert.equal(membership.created_by_user_id, 'admin-user');
  assert.equal(inserts[2].steps[0][1].event_membership_id, 'm1');
  assert.equal(inserts[2].steps[0][1].alias, 'Ana');
  assert.equal(JSON.stringify(inserts).includes(password), false, 'Ningun insert debe llevar la contrasena en claro');
  h.done();
});

test('un rechazo de bcrypt no inserta ningun user', async () => {
  const hashError = new Error('No se pudo calcular hash');
  const h = harness([{ data: null }], { hashError });
  await assert.rejects(h.service.createParticipantAccount(input(), 'admin-user'), error => error === hashError);
  assert.equal(h.generated, 1);
  assert.deepEqual(h.hashCalls, [[password, 10]]);
  assert.equal(h.calls.some(call => call.table === 'users'), false);
  assert.equal(h.calls.some(call => call.steps.some(step => step[0] === 'insert')), false);
  assert.equal(h.rpcCalls.length, 0);
  h.done();
});
