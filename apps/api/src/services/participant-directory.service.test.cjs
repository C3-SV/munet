const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Pruebas con sustitutos: la base se simula con un constructor de consultas que
// aplica eq/is, orden y rango. Asi se comprueba que el servicio pide solo lo
// autorizado y que la paginacion se hace despues de filtrar.

const serviceFile = path.join(__dirname, 'participant-directory.service.ts');
const controllerFile = path.join(__dirname, '../controllers/events.controller.ts');
const rbacFile = path.join(__dirname, '../utils/rbac.utils.ts');
const routesFile = path.join(__dirname, '../routes/events.routes.ts');

const COMMITTEE_CSNU = '11111111-1111-4111-8111-111111111111';
const COMMITTEE_DELETED = '22222222-2222-4222-8222-222222222222';
const COMMITTEE_OTHER_EVENT = '33333333-3333-4333-8333-333333333333';
const UNKNOWN_COMMITTEE = '44444444-4444-4444-8444-444444444444';

const pad = (value, width) => String(value).padStart(width, '0');
const plain = value => JSON.parse(JSON.stringify(value));

const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;

const consoleLogs = [];
function loadModule(file, requireFn) {
  const module = { exports: {} };
  vm.runInNewContext(compile(file), {
    module, exports: module.exports, require: requireFn,
    console: { error: (...args) => consoleLogs.push(args) },
  });
  return module.exports;
}

// Utilidad real de avatares: el directorio la usa para elegir la foto o el predeterminado.
const avatarUtils = loadModule(path.join(__dirname, '../utils/avatar.utils.ts'), () => { throw new Error('sin imports'); });

const getPath = (row, dotted) => dotted.split('.').reduce((value, key) => (value == null ? undefined : value[key]), row);

const compareRows = orders => (a, b) => {
  for (const [column, ascending] of orders) {
    const left = getPath(a, column) ?? '';
    const right = getPath(b, column) ?? '';
    if (left !== right) return (left < right ? -1 : 1) * (ascending ? 1 : -1);
  }
  return 0;
};

function fakeDb(tables, { failTable = null } = {}) {
  const calls = [];
  const client = { from(table) {
    const call = { table, steps: [] };
    calls.push(call);
    const filters = [];
    const orders = [];
    let range = null;
    let single = false;

    const run = () => {
      if (table === failTable) return { data: null, error: { message: `Fallo de ${table}` } };
      let rows = (tables[table] ?? []).filter(row => filters.every(matches => matches(row)));
      rows = [...rows].sort(compareRows(orders));
      if (single) return { data: rows[0] ?? null, error: null };
      if (range) rows = rows.slice(range[0], range[1] + 1);
      return { data: plain(rows), error: null };
    };

    const builder = new Proxy({}, { get(_, method) {
      if (method === 'then') return (resolve, reject) => Promise.resolve(run()).then(resolve, reject);
      if (method === 'maybeSingle') return () => { single = true; call.steps.push(['maybeSingle']); return builder; };
      return (...args) => {
        call.steps.push([method, ...args]);
        if (method === 'eq') filters.push(row => getPath(row, args[0]) === args[1]);
        if (method === 'is') filters.push(row => (getPath(row, args[0]) ?? null) === args[1]);
        if (method === 'order') orders.push([args[0], args[1]?.ascending !== false]);
        if (method === 'range') range = [args[0], args[1]];
        return builder;
      };
    } });
    return builder;
  } };
  return { client, calls };
}

const committees = [
  { id: COMMITTEE_CSNU, event_id: 'event', name: 'CSNU', deleted_at: null },
  { id: COMMITTEE_DELETED, event_id: 'event', name: 'Comite retirado', deleted_at: '2026-09-01T00:00:00Z' },
  { id: COMMITTEE_OTHER_EVENT, event_id: 'other', name: 'Ajeno', deleted_at: null },
];
const CSNU = { id: COMMITTEE_CSNU, name: 'CSNU', deleted_at: null };
const RETIRED = { id: COMMITTEE_DELETED, name: 'Comite retirado', deleted_at: '2026-09-01T00:00:00Z' };

// Fila de profiles con la membership embebida, igual que devuelve el !inner.
// Incluye participant_code y email para comprobar que nunca salen en la respuesta.
const row = (id, first, last, options = {}) => {
  const { alias = null, photo = null, eventId = 'event', status = 'ACTIVE', deletedAt = null, committee = null, delegation = null } = options;
  return {
    event_membership_id: id,
    first_name: first,
    last_name: last,
    alias,
    profile_image_path: photo,
    event_memberships: {
      id,
      event_id: eventId,
      account_status: status,
      deleted_at: deletedAt,
      committee_id: committee ? committee.id : null,
      committees: committee,
      delegation_code: delegation,
      participant_code: `COD-${id}`,
      email: `${id}@example.test`,
    },
  };
};

const directory = async (profiles, overrides = {}, options) => {
  const db = fakeDb({ committees, profiles }, options);
  const service = loadModule(serviceFile, name => {
    if (name === '../lib/supabase') return { supabaseAdmin: db.client };
    if (name === '../utils/avatar.utils') return avatarUtils;
    throw new Error(`Import inesperado: ${name}`);
  });
  const result = await service.listParticipantDirectory({
    eventId: 'event',
    query: { q: '', committeeId: null, page: 1, limit: 20, ...overrides },
  });
  return { result: plain(result), calls: db.calls, service };
};

const ids = result => result.body.participants.map(item => item.membershipId);
const profileCalls = calls => calls.filter(call => call.table === 'profiles');

test('parseParticipantDirectoryQuery aplica valores por defecto y acepta limites validos', () => {
  const service = loadModule(serviceFile, () => ({ supabaseAdmin: {} }));
  assert.deepEqual(plain(service.parseParticipantDirectoryQuery({})),
    { ok: true, value: { q: '', committeeId: null, page: 1, limit: 20 } });
  assert.deepEqual(plain(service.parseParticipantDirectoryQuery({ page: '3', limit: '100', q: 'ana', committee_id: COMMITTEE_CSNU })),
    { ok: true, value: { q: 'ana', committeeId: COMMITTEE_CSNU, page: 3, limit: 100 } });
});

test('parseParticipantDirectoryQuery rechaza page, limit, committee_id y q fuera de contrato', () => {
  const service = loadModule(serviceFile, () => ({ supabaseAdmin: {} }));
  const cases = [
    { page: '0' }, { page: '-1' }, { page: '1.5' }, { page: 'abc' }, { page: '' }, { page: ['1', '2'] },
    { limit: '0' }, { limit: '101' }, { limit: '' }, { limit: '10abc' }, { limit: '1e2' },
    { committee_id: 'no-es-uuid' }, { committee_id: '' }, { committee_id: ['x'] },
    { q: ['ana', 'luis'] },
  ];
  for (const input of cases) {
    const parsed = plain(service.parseParticipantDirectoryQuery(input));
    assert.equal(parsed.ok, false, `Debe rechazar ${JSON.stringify(input)}`);
    assert.equal(typeof parsed.error, 'string');
  }
});

test('encuentra una coincidencia que queda despues de las primeras 80 filas del evento', async () => {
  const profiles = Array.from({ length: 130 }, (_, index) => row(`m-${pad(index, 3)}`, 'Delegado', `Apellido${pad(index, 3)}`));
  profiles.push(row('m-zz', 'Ximena', 'Zuñiga', { alias: 'Xime' }));
  for (const q of ['zuniga', 'ZUÑIGA', 'xime']) {
    const { result } = await directory(profiles, { q });
    assert.deepEqual(ids(result), ['m-zz'], `Busqueda: ${q}`);
    assert.equal(result.body.hasMore, false);
  }
});

test('lee lotes ordenados de 500 hasta hallar una coincidencia en el ultimo lote', async () => {
  const profiles = Array.from({ length: 1205 }, (_, index) => row(`m-${pad(index, 4)}`, 'Delegado', `Apellido${pad(index, 4)}`));
  profiles.push(row('m-quispe', 'Ines', 'Quispe'));
  const { result, calls } = await directory(profiles, { q: 'quispe' });
  assert.deepEqual(ids(result), ['m-quispe']);
  assert.equal(result.body.hasMore, false);
  const ranges = profileCalls(calls).map(call => call.steps.find(step => step[0] === 'range'));
  assert.deepEqual(ranges, [['range', 0, 499], ['range', 500, 999], ['range', 1000, 1499]]);
});

test('deja de leer en cuanto confirma que existe una pagina siguiente', async () => {
  const profiles = Array.from({ length: 1206 }, (_, index) => row(`m-${pad(index, 4)}`, 'Delegado', `Apellido${pad(index, 4)}`));
  const { result, calls } = await directory(profiles, { q: 'apellido', limit: 2, page: 1 });
  assert.deepEqual(ids(result), ['m-0000', 'm-0001']);
  assert.equal(result.body.hasMore, true);
  assert.equal(profileCalls(calls).length, 1);
});

test('compara sin tildes, sin mayusculas y con forma Unicode distinta', async () => {
  const profiles = [
    row('m-1', 'Jose', 'Muñoz', { alias: 'Pepé', delegation: '#042' }),
    row('m-2', 'Ana', 'Pérez'),
    row('m-3', 'Lucía', 'Ñúñez', { alias: 'Lu' }),
    row('m-4', 'Lucia', 'Vargas'),
  ];
  const cases = [
    ['munoz', ['m-1']], ['MUÑOZ', ['m-1']], ['José', ['m-1']], ['pepe', ['m-1']], ['PEPÉ', ['m-1']],
    ['nunez', ['m-3']], ['ñúñez', ['m-3']], ['perez', ['m-2']], ['Pérez', ['m-2']],
    ['lucia', ['m-3', 'm-4']], ['Lucía', ['m-3', 'm-4']], ['#042', ['m-1']], ['042', ['m-1']],
    ['noexiste', []],
  ];
  for (const [q, expected] of cases) {
    const { result } = await directory(profiles, { q });
    assert.deepEqual([...ids(result)].sort(), expected, `Busqueda: ${q}`);
  }
});

test('reparte personas con el mismo nombre en paginas sin repetir ni omitir', async () => {
  const profiles = [
    ...Array.from({ length: 5 }, (_, index) => row(`m-${index}`, 'Ana', 'Pérez')),
    row('m-z', 'Ana', 'Zapata'),
  ];
  const pages = [];
  for (const page of [1, 2, 3, 4]) {
    const { result } = await directory(profiles, { q: 'ana', limit: 2, page });
    pages.push(result.body);
  }
  assert.deepEqual(pages.map(body => body.participants.map(item => item.membershipId)),
    [['m-0', 'm-1'], ['m-2', 'm-3'], ['m-4', 'm-z'], []]);
  assert.deepEqual(pages.map(body => body.hasMore), [true, true, false, false]);
  const all = pages.flatMap(body => body.participants.map(item => item.membershipId));
  assert.equal(new Set(all).size, all.length);
  assert.deepEqual(pages[0].page, 1);
  assert.deepEqual(pages[0].limit, 2);
});

test('una pagina final vacia responde lista vacia y hasMore falso', async () => {
  const profiles = [row('m-1', 'Ana', 'Uno'), row('m-2', 'Ana', 'Dos'), row('m-3', 'Ana', 'Tres')];
  const second = await directory(profiles, { limit: 2, page: 2 });
  assert.deepEqual(ids(second.result), ['m-1']);
  assert.equal(second.result.body.hasMore, false);
  const beyond = await directory(profiles, { limit: 2, page: 3 });
  assert.deepEqual(beyond.result.body, { participants: [], page: 3, limit: 2, hasMore: false });
});

test('aplica comite y texto antes de paginar y solo toma membresias activas del evento', async () => {
  const profiles = [
    ...Array.from({ length: 5 }, (_, index) => row(`m-c${index}`, 'Delegada', `Csnu${index}`, { committee: CSNU })),
    row('m-otro', 'Delegada', 'Otro', { committee: null }),
    row('m-suspendido', 'Delegada', 'Suspendida', { committee: CSNU, status: 'SUSPENDED' }),
    row('m-borrado', 'Delegada', 'Borrada', { committee: CSNU, deletedAt: '2026-10-01T00:00:00Z' }),
    row('m-otro-evento', 'Delegada', 'Ajena', { committee: CSNU, eventId: 'other' }),
  ];
  const { result, calls } = await directory(profiles, { committeeId: COMMITTEE_CSNU, limit: 2, page: 3 });
  assert.deepEqual(ids(result), ['m-c4']);
  assert.equal(result.body.hasMore, false);
  const profileQuery = profileCalls(calls)[0];
  assert.deepEqual(profileQuery.steps.filter(step => step[0] === 'eq'), [
    ['eq', 'event_memberships.event_id', 'event'],
    ['eq', 'event_memberships.account_status', 'ACTIVE'],
    ['eq', 'event_memberships.committee_id', COMMITTEE_CSNU],
  ]);
  assert.deepEqual(profileQuery.steps.find(step => step[0] === 'is'), ['is', 'event_memberships.deleted_at', null]);
});

test('sin texto ni comite devuelve todas las membresias activas con paginacion estable', async () => {
  const profiles = [
    row('m-2', 'Luis', 'Gomez'), row('m-1', 'Ana', 'Perez'), row('m-3', 'Ana', 'Perez', { status: 'SUSPENDED' }),
  ];
  const { result } = await directory(profiles, { q: '   ' });
  // Orden por apellido: Gomez antes que Perez.
  assert.deepEqual(ids(result), ['m-2', 'm-1']);
  assert.equal(result.body.hasMore, false);
});

test('rechaza un comite de otro evento, eliminado o inexistente con 400 sin listar', async () => {
  for (const committeeId of [COMMITTEE_OTHER_EVENT, COMMITTEE_DELETED, UNKNOWN_COMMITTEE]) {
    const { result, calls } = await directory([row('m-1', 'Ana', 'Perez', { committee: CSNU })], { committeeId });
    assert.equal(result.status, 400);
    assert.match(result.body.error, /committee_id/);
    assert.equal(profileCalls(calls).length, 0);
  }
});

test('nunca expone participant_code, email ni datos de administracion', async () => {
  const profiles = [
    row('m-1', 'Ana', 'Perez', { alias: 'Anita', delegation: '#001', committee: CSNU }),
    row('m-2', 'Luis', 'Gomez', { committee: RETIRED }),
  ];
  const { result } = await directory(profiles);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('COD-'), false);
  assert.equal(serialized.includes('@example.test'), false);
  assert.deepEqual(Object.keys(result.body).sort(), ['hasMore', 'limit', 'page', 'participants']);
  for (const item of result.body.participants) {
    assert.deepEqual(Object.keys(item).sort(), ['alias', 'avatar', 'committee', 'delegationCode', 'firstName', 'lastName', 'membershipId']);
  }
  const byId = Object.fromEntries(result.body.participants.map(item => [item.membershipId, item]));
  assert.deepEqual(byId['m-1'], {
    membershipId: 'm-1', firstName: 'Ana', lastName: 'Perez', alias: 'Anita',
    avatar: 'https://ui-avatars.com/api/?name=Ana%20Perez&background=E5E7EB&color=111827',
    committee: { id: COMMITTEE_CSNU, name: 'CSNU' }, delegationCode: '#001',
  });
  // El comite retirado no se muestra aunque la membresia lo siga apuntando.
  assert.equal(byId['m-2'].committee, null);
  assert.equal(byId['m-2'].alias, null);
  assert.equal(byId['m-2'].delegationCode, null);
});

test('devuelve error 500 sin detalles internos si falla la consulta de perfiles', async () => {
  const { result } = await directory([row('m-1', 'Ana', 'Perez')], {}, { failTable: 'profiles' });
  assert.equal(result.status, 500);
  assert.deepEqual(result.body, { error: 'No se pudieron consultar los participantes' });
});

// ---- Controlador ----

const viewer = {
  id: 'm-viewer', userId: 'u-viewer', eventId: 'event', eventName: 'Evento', eventSlug: 'evento',
  eventStatus: 'ACTIVE', role: 'PARTICIPANT', committeeId: COMMITTEE_CSNU, committeeName: 'CSNU',
  committeeCode: 'CSNU', participantCode: 'COD-viewer', accountStatus: 'ACTIVE',
};

function controllerHarness(profiles) {
  const db = fakeDb({ committees, profiles });
  const requireDb = name => {
    if (name === '../lib/supabase') return { supabaseAdmin: db.client };
    if (name === '../utils/avatar.utils') return avatarUtils;
    throw new Error(`Import inesperado: ${name}`);
  };
  const controller = loadModule(controllerFile, name => {
    if (name === '../lib/supabase') return { supabaseAdmin: db.client };
    if (name === '../utils/avatar.utils') return avatarUtils;
    if (name === '../services/walls.service') return { loadWallsByEvent: async () => [], mapWallForMembership: () => ({}) };
    if (name === '../utils/rbac.utils') return loadModule(rbacFile, () => { throw new Error('Import inesperado'); });
    if (name === '../services/participant-directory.service') return loadModule(serviceFile, requireDb);
    throw new Error(`Import inesperado: ${name}`);
  });
  return { controller, calls: db.calls };
}

const request = ({ eventId = 'event', query = {}, headers = {}, memberships = [viewer] } = {}) => ({
  params: { eventId },
  query,
  auth: { token: 't', supabaseAuthUserId: 's', userId: 'u-viewer', memberships },
  header: name => headers[name.toLowerCase()],
});

const response = () => ({
  statusCode: 200, body: undefined,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const sample = () => [row('m-1', 'Ana', 'Perez', { committee: CSNU, delegation: '#001' }), row('m-2', 'Luis', 'Gomez')];

test('el controlador responde 403 si el actor no tiene membresia activa en el evento de la ruta', async () => {
  const otherEvent = { ...viewer, eventId: 'other' };
  const inactive = { ...viewer, accountStatus: 'SUSPENDED' };
  for (const memberships of [[otherEvent], [inactive], []]) {
    const { controller, calls } = controllerHarness(sample());
    const res = response();
    await controller.listEventParticipants(request({ memberships }), res);
    assert.equal(res.statusCode, 403);
    assert.equal(calls.length, 0);
  }
});

test('el controlador exige que x-event-id coincida con el evento de la ruta', async () => {
  const mismatch = controllerHarness(sample());
  const res400 = response();
  await mismatch.controller.listEventParticipants(request({ headers: { 'x-event-id': 'other' } }), res400);
  assert.equal(res400.statusCode, 400);
  assert.equal(mismatch.calls.length, 0);

  const match = controllerHarness(sample());
  const res200 = response();
  await match.controller.listEventParticipants(request({ headers: { 'x-event-id': ' event ' } }), res200);
  assert.equal(res200.statusCode, 200);
});

test('el controlador rechaza page, limit y committee_id invalidos con 400 sin consultar', async () => {
  const cases = [
    { page: '0' }, { page: 'uno' }, { limit: '0' }, { limit: '101' }, { limit: 'mucho' },
    { committee_id: 'csnu' }, { committee_id: COMMITTEE_OTHER_EVENT }, { q: ['a', 'b'] },
  ];
  for (const query of cases) {
    const { controller, calls } = controllerHarness(sample());
    const res = response();
    await controller.listEventParticipants(request({ query }), res);
    assert.equal(res.statusCode, 400, JSON.stringify(query));
    assert.equal(typeof res.body.error, 'string');
    assert.equal(calls.filter(call => call.table === 'profiles').length, 0);
  }
});

test('el controlador responde 200 con el contrato y sin codigo ni correo', async () => {
  const { controller } = controllerHarness(sample());
  const res = response();
  await controller.listEventParticipants(request({ query: { q: 'ana', page: '1', limit: '20' } }), res);
  assert.equal(res.statusCode, 200);
  const body = plain(res.body);
  assert.deepEqual(body, {
    participants: [{ membershipId: 'm-1', firstName: 'Ana', lastName: 'Perez', alias: null,
      avatar: 'https://ui-avatars.com/api/?name=Ana%20Perez&background=E5E7EB&color=111827',
      committee: { id: COMMITTEE_CSNU, name: 'CSNU' }, delegationCode: '#001' }],
    page: 1, limit: 20, hasMore: false,
  });
  assert.equal(JSON.stringify(body).includes('COD-'), false);
  assert.equal(JSON.stringify(body).includes('@example.test'), false);
});

test('el controlador rechaza un comite de otro evento con 400 y sin listar participantes', async () => {
  const { controller, calls } = controllerHarness(sample());
  const res = response();
  await controller.listEventParticipants(request({ query: { committee_id: COMMITTEE_OTHER_EVENT } }), res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /committee_id/);
  assert.equal(calls.filter(call => call.table === 'profiles').length, 0);
});

test('la ruta exige autenticacion antes de llegar al controlador', () => {
  const source = fs.readFileSync(routesFile, 'utf8');
  assert.match(source, /router\.get\('\/:eventId\/participants', requireAuth, listEventParticipants\)/);
});

test('el directorio devuelve la foto de perfil cuando existe y un avatar predeterminado cuando no', async () => {
  const photo = 'https://proyecto.supabase.co/storage/v1/object/public/profile-images/e/m/123-foto.png';
  const { result } = await directory([
    row('m-1', 'Ana', 'Perez', { photo }),
    row('m-2', 'Beto', 'Rios'),
    row('m-3', 'Cris', 'Soto', { photo: '   ' }),
    row('m-4', 'Dana', 'Vega', { photo: 'ruta/sin/url.png' }),
  ]);
  const byId = Object.fromEntries(result.body.participants.map(item => [item.membershipId, item]));

  assert.equal(byId['m-1'].avatar, photo);
  for (const id of ['m-2', 'm-3', 'm-4']) {
    assert.match(byId[id].avatar, /^https:\/\/ui-avatars\.com\/api\/\?name=/, id);
  }
  assert.match(byId['m-2'].avatar, /name=Beto%20Rios/);
});
