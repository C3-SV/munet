const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
require('ts-node').register({ project: 'apps/api/tsconfig.json' });

function harness({ memberships = [], invalidToken = false, token = 'Bearer valido' } = {}) {
  const calls = [];
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(__dirname + '/auth.middleware.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, console, require(name) {
    if (name === '../lib/supabase') return { supabaseAdmin: { auth: { async getUser(value) {
      calls.push(value);
      return invalidToken ? { data: { user: null }, error: { message: 'invalido' } } : { data: { user: { id: 'auth-user' } }, error: null };
    } } } };
    if (name === '../services/auth-context.service') return {
      async getUserBySupabaseAuthId(id) { assert.equal(id, 'auth-user'); return { id: 'user' }; },
      async getMembershipsByUserId(id) { assert.equal(id, 'user'); return memberships; },
    };
    if (name === '../utils/rbac.utils') return require('../utils/rbac.utils.ts');
    throw new Error(`Import inesperado: ${name}`);
  } });
  const req = { header: name => name === 'authorization' ? token : undefined };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  let nextCalls = 0;
  return { req, res, calls, get nextCalls() { return nextCalls; }, async run(resolver = () => 'event', options) {
    let authenticated = false;
    await module.exports.requireAuth(req, res, () => { authenticated = true; });
    if (authenticated) await module.exports.requireEventAdmin(resolver, options)(req, res, () => { nextCalls++; });
  } };
}

test('sin token o con token invalido la cadena devuelve 401', async () => {
  for (const options of [{ token: undefined }, { token: '' }, { invalidToken: true }]) {
    const h = harness(options.token === undefined && !options.invalidToken ? { token: null } : options);
    await h.run();
    assert.equal(h.res.statusCode, 401);
    assert.equal(h.nextCalls, 0);
    assert.equal(h.calls.length, options.invalidToken ? 1 : 0);
  }
});
test('participante, admin ajeno y admin inactivo no administran el evento', async () => {
  for (const membership of [
    { eventId: 'event', role: 'PARTICIPANT', accountStatus: 'ACTIVE' },
    { eventId: 'otro', role: 'ADMIN_MUN', accountStatus: 'ACTIVE' },
    ...['SUSPENDED', 'PENDING_ACTIVATION', null].map(accountStatus => ({ eventId: 'event', role: 'ADMIN_MUN', accountStatus })),
  ]) {
    const h = harness({ memberships: [membership] });
    await h.run();
    assert.equal(h.res.statusCode, 403);
    assert.equal(h.nextCalls, 0);
    assert.equal(h.req.auth.currentMembership, undefined);
  }
});
test('admin activo del evento avanza y adjunta la membership correcta', async () => {
  const membership = { eventId: 'event', role: 'ADMIN_MUN', accountStatus: 'ACTIVE' };
  const h = harness({ memberships: [{ ...membership, eventId: 'otro' }, membership] });
  await h.run(async () => 'event');
  assert.equal(h.res.statusCode, 200);
  assert.equal(h.nextCalls, 1);
  assert.equal(h.req.auth.currentMembership, membership);
});
test('resolver sin evento devuelve 400 o missingStatus configurado', async () => {
  for (const options of [undefined, { missingStatus: 404, missingMessage: 'No encontrado' }]) {
    const h = harness();
    await h.run(async () => null, options);
    assert.equal(h.res.statusCode, options?.missingStatus ?? 400);
    assert.equal(h.nextCalls, 0);
    if (options) assert.equal(h.res.body.error, options.missingMessage);
  }
});

test('todas las rutas administrativas tienen autenticacion y autorizacion apropiada', () => {
  const source = ts.createSourceFile('admin.routes.ts', fs.readFileSync(__dirname + '/../routes/admin.routes.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  const guards = new Set();
  const routes = [];
  const identifier = (node, name) => ts.isIdentifier(node) && node.text === name;
  const directGuard = node => ts.isCallExpression(node) && identifier(node.expression, 'requireEventAdmin');
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && directGuard(node.initializer)) {
      assert.ok(node.parent.flags & ts.NodeFlags.Const, 'El guard compartido debe ser constante');
      guards.add(node.name.text);
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && identifier(node.expression.expression, 'router') && ['get', 'post', 'patch', 'put', 'delete'].includes(node.expression.name.text)) routes.push(node);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(routes.length > 0, 'Debe encontrar rutas');
  const exceptions = [];
  for (const route of routes) {
    const [path, ...handlers] = route.arguments;
    assert.ok(path && ts.isStringLiteralLike(path), 'Ruta con path literal requerido para auditar');
    const label = `${route.expression.name.text.toUpperCase()} ${path.text}`;
    const authIndex = handlers.findIndex(node => identifier(node, 'requireAuth'));
    assert.ok(authIndex >= 0, `${label}: falta requireAuth`);
    const exception = ['GET /events', 'POST /events'].includes(label);
    const guardIndex = handlers.findIndex(node => exception ? identifier(node, 'requireAdmin') : directGuard(node) || (ts.isIdentifier(node) && guards.has(node.text)));
    assert.ok(guardIndex > authIndex && guardIndex < handlers.length - 1, `${label}: autorizacion ausente o fuera de orden`);
    assert.equal(authIndex, 0, `${label}: autenticar antes de ejecutar handlers`);
    assert.equal(guardIndex, 1, `${label}: autorizar antes del controlador`);
    if (exception) exceptions.push(label);
    else assert.ok(!handlers.some(node => identifier(node, 'requireAdmin')), `${label}: requireAdmin global no permitido`);
  }
  assert.deepEqual(exceptions.sort(), ['GET /events', 'POST /events']);
});
