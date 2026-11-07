const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const code = ts.transpileModule(fs.readFileSync(__dirname + '/participant-search.service.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;
const plain = value => JSON.parse(JSON.stringify(value));
const params = overrides => ({
  eventId: 'event', q: 'ana', page: 1, limit: 20,
  filters: { committeeId: null, role: null, status: null }, ...overrides,
});
const membership = (id, overrides = {}) => ({
  id, event_id: 'event', user_id: `u-${id}`, created_at: '2026-10-01T00:00:00Z',
  participant_code: `COD-${id}`, delegation_code: null, ...overrides,
});
const profile = (id, overrides = {}) => ({
  event_membership_id: id, first_name: 'Ana', last_name: 'Pérez', display_name: null, alias: null,
  event_memberships: { event_id: 'event' }, ...overrides,
});
const pageResult = (table, data) => ({ table, result: { data, error: null } });

function harness(results) {
  const pending = [...results];
  const calls = [];
  const client = { from(table) {
    const expected = pending.shift();
    assert.ok(expected, `Consulta inesperada: ${table}`);
    assert.equal(table, expected.table);
    const call = { table, steps: [], executed: false };
    calls.push(call);
    const query = new Proxy({}, { get(_, method) {
      if (method === 'then') return (resolve, reject) => {
        call.executed = true;
        return Promise.resolve(expected.result).then(resolve, reject);
      };
      return (...args) => { call.steps.push([method, ...args]); return query; };
    } });
    return query;
  } };
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require(name) {
    if (name === '../lib/supabase') return { supabaseAdmin: client };
    throw new Error(`Import inesperado: ${name}`);
  } });
  return { searchParticipants: module.exports.searchParticipants, calls,
    done() {
      assert.equal(pending.length, 0, 'Consultas pendientes');
      assert.ok(calls.every(call => call.executed), 'Cada consulta debe ejecutarse');
    },
  };
}

for (const q of ['perez', 'PEREZ', 'ana perez', 'ÁNA PÉREZ', 'embajadora', 'login-ana', '042', '#042', 'voz diplomatica']) {
  test(`busca por nombre, alias o codigo sin tildes ni mayusculas: ${q}`, async () => {
    const target = membership('m1', { participant_code: 'LOGIN-ANA', delegation_code: '#042' });
    const targetProfile = profile('m1', { alias: 'Embajádora', display_name: 'Voz Diplomática' });
    const h = harness([
      pageResult('event_memberships', [membership('m2'), target]),
      pageResult('profiles', [targetProfile, profile('m2', { first_name: 'Luis', last_name: 'Gomez' })]),
    ]);
    const result = await h.searchParticipants(params({ q }));
    const { event_memberships, ...publicProfile } = targetProfile;
    assert.deepEqual(plain(result), { body: {
      participants: [{ ...target, profile: publicProfile }],
      pagination: { page: 1, limit: 20, total: 1, total_pages: 1 },
    } });
    h.done();
  });
}

test('conserva las 501 coincidencias por nombre y pagina despues del perfil 500', async () => {
  // Regresion trasladada del controlador: el servicio debe contar todos los perfiles.
  const memberships = Array.from({ length: 501 }, (_, index) => membership(`m${index}`));
  const profiles = memberships.map(row => profile(row.id));
  const h = harness([pageResult('event_memberships', memberships), pageResult('profiles', profiles)]);
  const { body } = await h.searchParticipants(params({ page: 26 }));
  assert.deepEqual(plain(body.pagination), { page: 26, limit: 20, total: 501, total_pages: 26 });
  assert.deepEqual(plain(body.participants.map(row => row.id)), ['m500']);
  assert.equal(body.participants[0].profile.first_name, 'Ana');
  assert.equal(h.calls.some(call => call.steps.some(step => step[0] === 'limit')), false);
  h.done();
});

test('pagina memberships y perfiles de 1000 en 1000 y aplica filtros de evento en todas las paginas', async () => {
  const memberships = Array.from({ length: 1001 }, (_, index) => membership(`m${index}`));
  const profiles = memberships.map(row => profile(row.id));
  const h = harness([
    pageResult('event_memberships', memberships.slice(0, 1000)),
    pageResult('event_memberships', memberships.slice(1000)),
    pageResult('profiles', profiles.slice(0, 1000)),
    pageResult('profiles', profiles.slice(1000)),
  ]);
  const { body } = await h.searchParticipants(params({
    page: 51, filters: { committeeId: 'c1', role: 'PARTICIPANT', status: 'ACTIVE' },
  }));
  assert.deepEqual(plain(body.pagination), { page: 51, limit: 20, total: 1001, total_pages: 51 });
  assert.deepEqual(plain(body.participants.map(row => row.id)), ['m1000']);
  assert.equal(body.participants[0].profile.event_membership_id, 'm1000');
  for (const [index, call] of h.calls.entries()) {
    const from = (index % 2) * 1000;
    assert.deepEqual(call.steps.find(step => step[0] === 'range'), ['range', from, from + 999]);
    assert.equal(call.steps.some(step => step[0] === 'limit' || step[0] === 'or'), false);
    if (call.table === 'event_memberships') {
      assert.deepEqual(call.steps.filter(step => step[0] === 'eq'), [
        ['eq', 'event_id', 'event'], ['eq', 'committee_id', 'c1'],
        ['eq', 'role', 'PARTICIPANT'], ['eq', 'account_status', 'ACTIVE'],
      ]);
      assert.deepEqual(call.steps.find(step => step[0] === 'is'), ['is', 'deleted_at', null]);
      assert.deepEqual(plain(call.steps.filter(step => step[0] === 'order')), [
        ['order', 'created_at', { ascending: false }], ['order', 'id', { ascending: true }],
      ]);
    } else {
      assert.match(call.steps.find(step => step[0] === 'select')[1], /event_memberships!inner\(event_id\)/);
      assert.deepEqual(call.steps.filter(step => step[0] === 'eq'), [['eq', 'event_memberships.event_id', 'event']]);
      assert.deepEqual(plain(call.steps.find(step => step[0] === 'order')),
        ['order', 'event_membership_id', { ascending: true }]);
    }
  }
  h.done();
});

test('termina al recibir paginas vacias despues de exactamente 1000 filas', async () => {
  const memberships = Array.from({ length: 1000 }, (_, index) => membership(`m${index}`));
  const h = harness([
    pageResult('event_memberships', memberships), pageResult('event_memberships', []),
    pageResult('profiles', memberships.map(row => profile(row.id))), pageResult('profiles', []),
  ]);
  const { body } = await h.searchParticipants(params({ page: 50 }));
  assert.deepEqual(plain(body.pagination), { page: 50, limit: 20, total: 1000, total_pages: 50 });
  assert.equal(body.participants.length, 20);
  assert.equal(body.participants.at(-1).id, 'm999');
  for (const index of [1, 3]) {
    assert.deepEqual(h.calls[index].steps.find(step => step[0] === 'range'), ['range', 1000, 1999]);
  }
  h.done();
});

for (const page of [1, 2, 3]) {
  test(`calcula total y total_pages sobre coincidencias antes de paginar: pagina ${page}`, async () => {
    const h = harness([
      pageResult('event_memberships', ['m1', 'm2', 'm3', 'm4', 'm5'].map(id => membership(id))),
      pageResult('profiles', ['m1', 'm3', 'm5'].map(id => profile(id))),
    ]);
    const { body } = await h.searchParticipants(params({ page, limit: 2 }));
    assert.deepEqual(plain(body.pagination), { page, limit: 2, total: 3, total_pages: 2 });
    assert.deepEqual(plain(body.participants.map(row => row.id)), { 1: ['m1', 'm3'], 2: ['m5'], 3: [] }[page]);
    assert.deepEqual(h.calls[0].steps.filter(step => step[0] === 'eq'), [['eq', 'event_id', 'event']]);
    h.done();
  });
}

test('busca por codigo sin perfil y tolera campos nulos sin producir coincidencias falsas', async () => {
  const h = harness([
    pageResult('event_memberships', [membership('m1', { participant_code: 'UNICO' }),
      membership('m2', { participant_code: null })]),
    pageResult('profiles', [profile('m2', { first_name: null, last_name: null })]),
  ]);
  const { body } = await h.searchParticipants(params({ q: 'unico' }));
  assert.deepEqual(plain(body.participants.map(row => ({ id: row.id, profile: row.profile }))), [{ id: 'm1', profile: null }]);
  assert.equal(body.pagination.total, 1);
  h.done();
});

for (const data of [null, [], [membership('m1')]]) {
  test(`sin coincidencias devuelve total cero con ${data === null ? 'data null' : data.length + ' memberships'}`, async () => {
    const h = harness([pageResult('event_memberships', data), pageResult('profiles', null)]);
    assert.deepEqual(plain(await h.searchParticipants(params({ q: 'inexistente' }))), { body: {
      participants: [], pagination: { page: 1, limit: 20, total: 0, total_pages: 0 },
    } });
    h.done();
  });
}

for (const table of ['event_memberships', 'profiles']) {
  for (const failedPage of [1, 2]) {
    test(`devuelve solo error si falla ${table} en la pagina ${failedPage}`, async () => {
      const results = table === 'profiles' ? [pageResult('event_memberships', [membership('m1')])] : [];
      if (failedPage === 2) {
        results.push(pageResult(table, Array.from({ length: 1000 }, (_, index) =>
          table === 'profiles' ? profile(`m${index}`) : membership(`m${index}`))));
      }
      const message = `Fallo de ${table}, pagina ${failedPage}`;
      results.push({ table, result: { data: null, error: { message } } });
      const h = harness(results);
      assert.deepEqual(plain(await h.searchParticipants(params())), { error: message });
      assert.deepEqual(h.calls.at(-1).steps.find(step => step[0] === 'range'),
        ['range', (failedPage - 1) * 1000, failedPage * 1000 - 1]);
      h.done();
    });
  }
}
