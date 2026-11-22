const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// El middleware solo importa tipos, asi que se carga sin Supabase ni variables de entorno.
function loadMiddleware() {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, 'event-status.middleware.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require(name) { throw new Error(`Import inesperado: ${name}`); } });
  return module.exports;
}

const membership = (overrides) => ({
  id: 'membership',
  eventId: 'event',
  role: 'PARTICIPANT',
  accountStatus: 'ACTIVE',
  eventStatus: 'ACTIVE',
  ...overrides,
});

function run({ method = 'POST', auth, headers = {} }) {
  const { requireEventOpenForWrites } = loadMiddleware();
  const req = { method, auth, header: (name) => headers[name.toLowerCase()] };
  const res = { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  let nextCalls = 0;
  requireEventOpenForWrites(req, res, () => { nextCalls += 1; });
  return { res, nextCalls };
}

test('las lecturas pasan aunque el evento este cerrado', () => {
  const auth = { memberships: [membership({ eventStatus: 'CLOSED' })] };
  for (const method of ['GET', 'HEAD', 'OPTIONS']) {
    const { res, nextCalls } = run({ method, auth, headers: { 'x-event-id': 'event' } });
    assert.equal(nextCalls, 1, method);
    assert.equal(res.statusCode, 200, method);
  }
});

test('las escrituras en evento cerrado responden 403 sin llegar al controlador', () => {
  const auth = { memberships: [membership({ eventStatus: 'CLOSED' })] };
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const { res, nextCalls } = run({ method, auth, headers: { 'x-event-id': 'event' } });
    assert.equal(nextCalls, 0, method);
    assert.equal(res.statusCode, 403, method);
    assert.equal(res.body.error, 'El evento esta cerrado', method);
  }
});

test('las escrituras en evento activo o archivado siguen su curso', () => {
  // ARCHIVED queda sin bloquear hasta que ADR-007 decida sus escrituras.
  for (const eventStatus of ['ACTIVE', 'ARCHIVED']) {
    const auth = { memberships: [membership({ eventStatus })] };
    const { res, nextCalls } = run({ method: 'POST', auth, headers: { 'x-event-id': 'event' } });
    assert.equal(nextCalls, 1, eventStatus);
    assert.equal(res.statusCode, 200, eventStatus);
  }
});

test('participante: el evento se elige por x-event-id entre sus membresias', () => {
  const auth = {
    memberships: [
      membership({ id: 'open', eventId: 'open-event', eventStatus: 'ACTIVE' }),
      membership({ id: 'closed', eventId: 'closed-event', eventStatus: 'CLOSED' }),
    ],
  };

  const blocked = run({ auth, headers: { 'x-event-id': 'closed-event' } });
  assert.equal(blocked.res.statusCode, 403);
  assert.equal(blocked.nextCalls, 0);

  const trimmed = run({ auth, headers: { 'x-event-id': '  closed-event  ' } });
  assert.equal(trimmed.res.statusCode, 403);

  const open = run({ auth, headers: { 'x-event-id': 'open-event' } });
  assert.equal(open.nextCalls, 1);
});

test('moderacion: currentMembership manda sobre x-event-id', () => {
  const open = membership({ id: 'open', eventId: 'open-event', eventStatus: 'ACTIVE' });
  const closed = membership({ id: 'closed', eventId: 'closed-event', eventStatus: 'CLOSED', role: 'MODERATOR' });
  const memberships = [open, closed];

  const closedByResource = run({ auth: { memberships, currentMembership: closed }, headers: { 'x-event-id': 'open-event' } });
  assert.equal(closedByResource.res.statusCode, 403);
  assert.equal(closedByResource.nextCalls, 0);

  const openByResource = run({ auth: { memberships, currentMembership: open }, headers: { 'x-event-id': 'closed-event' } });
  assert.equal(openByResource.nextCalls, 1);
});

test('sin evento resoluble la guarda no decide: el controlador responde', () => {
  const auth = { memberships: [membership({ eventStatus: 'CLOSED' })] };

  const withoutHeader = run({ auth, headers: {} });
  assert.equal(withoutHeader.nextCalls, 1);

  const unknownEvent = run({ auth, headers: { 'x-event-id': 'ajeno' } });
  assert.equal(unknownEvent.nextCalls, 1);
});

test('sin sesion una escritura responde 401', () => {
  const { res, nextCalls } = run({ method: 'POST', auth: undefined, headers: { 'x-event-id': 'event' } });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalls, 0);
});

// Cada escritura de las rutas de participante y de moderacion debe llevar la guarda.
// Las de gestion administrativa del evento y auth quedan fuera a proposito.
function writeRoutes(file) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'routes', file), 'utf8');
  const declared = source.match(/router\.(post|put|patch|delete)\(/g) ?? [];
  const routes = [...source.matchAll(/router\.(post|put|patch|delete)\(\s*'([^']*)'([^;]*?)\);/g)].map((match) => ({
    method: match[1].toUpperCase(),
    path: match[2],
    guarded: match[3].includes('requireEventOpenForWrites'),
  }));
  assert.equal(routes.length, declared.length, `${file}: no se leyeron todas las escrituras`);
  return routes;
}

test('posts y mensajes directos: toda escritura lleva la guarda', () => {
  for (const file of ['posts.routes.ts', 'dm.routes.ts']) {
    const routes = writeRoutes(file);
    assert.ok(routes.length > 0, file);
    for (const route of routes) assert.ok(route.guarded, `${file} ${route.method} ${route.path}`);
  }
});

test('perfil: el propio (/me) y la edicion administrativa de un participante llevan la guarda', () => {
  const routes = writeRoutes('profiles.routes.ts');
  assert.ok(routes.length > 0);
  for (const route of routes) assert.ok(route.guarded, `profiles ${route.method} ${route.path}`);
});

test('administracion: solo la moderacion lleva la guarda', () => {
  const routes = writeRoutes('admin.routes.ts');
  const moderation = routes.filter((route) => route.path.startsWith('/moderation/'));
  assert.equal(moderation.length, 9);
  for (const route of routes) {
    assert.equal(route.guarded, route.path.startsWith('/moderation/'), `admin ${route.method} ${route.path}`);
  }
});
