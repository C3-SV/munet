const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
require('ts-node').register({ project: 'apps/api/tsconfig.json' });

function harness({ memberships = [], invalidToken = false, token = 'Bearer valido', resource = { data: null } } = {}) {
  const calls = [];
  const queries = [];
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(__dirname + '/auth.middleware.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, console, require(name) {
    if (name === '../lib/supabase') return { supabaseAdmin: { from(table) {
      const steps = [];
      queries.push({ table, steps });
      const query = new Proxy({}, { get(_, method) {
        if (method === 'then') return (resolve, reject) => Promise.resolve(resource).then(resolve, reject);
        return (...args) => { steps.push([method, ...args]); return query; };
      } });
      return query;
    }, auth: { async getUser(value) {
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
  return { middleware: module.exports, req, res, calls, queries, get nextCalls() { return nextCalls; }, async run(resolver = () => 'event', options) {
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

test('resolvers de moderacion usan el recurso real, conservan borrados y distinguen 404 de 500', async () => {
  for (const [resolver, table, reqPart] of [
    ['eventIdFromWall', 'walls', { query: { wall_id: 'target', event_id: 'ajeno' } }],
    ['eventIdFromPost', 'posts', { params: { postId: 'target' } }],
    ['eventIdFromComment', 'post_comments', { params: { commentId: 'target' } }],
  ]) {
    for (const resource of [{ data: { event_id: 'event' } }, { data: null }, { data: null, error: { message: 'fallo' } }]) {
      const h = harness({ resource });
      Object.assign(h.req, reqPart, { auth: { memberships: [{ eventId: 'event', role: 'MODERATOR', accountStatus: 'ACTIVE' }] } });
      let passed = false;
      await h.middleware.requireEventModerator(h.middleware[resolver], { missingStatus: 404 })(h.req, h.res, () => { passed = true; });
      assert.equal(h.res.statusCode, resource.error ? 500 : resource.data ? 200 : 404);
      assert.equal(passed, !!resource.data);
      assert.equal(h.queries[0].table, table);
      assert.ok(h.queries[0].steps.some(s => s[0] === 'eq' && s[1] === 'id' && s[2] === 'target'));
      if (table !== 'walls') assert.ok(!h.queries[0].steps.some(s => s[0] === 'is' && s[1] === 'deleted_at'));
    }
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
  const directGuard = node => ts.isCallExpression(node) && ['requireEventAdmin', 'requireEventModerator'].some(name => identifier(node.expression, name));
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
    const guardIndex = handlers.findIndex(node => exception ? identifier(node, label === 'POST /events' ? 'requireSuperAdmin' : 'requireAdmin') : directGuard(node) || (ts.isIdentifier(node) && guards.has(node.text)));
    assert.ok(guardIndex > authIndex && guardIndex < handlers.length - 1, `${label}: autorizacion ausente o fuera de orden`);
    assert.equal(authIndex, 0, `${label}: autenticar antes de ejecutar handlers`);
    assert.equal(guardIndex, 1, `${label}: autorizar antes del controlador`);
    if (exception) exceptions.push(label);
    else assert.ok(!handlers.some(node => identifier(node, 'requireAdmin')), `${label}: requireAdmin global no permitido`);
  }
  assert.deepEqual(exceptions.sort(), ['GET /events', 'POST /events']);
});


test('superadmin exige ADMIN_TECH exacto normalizado y activo, y adjunta actor', () => {
  for (const role of ['ADMIN_TECH', ' admin_tech ', 'ADMIN_MUN', 'ADMIN', 'MODERATOR', 'XADMIN_TECH']) {
    for (const accountStatus of ['ACTIVE', 'SUSPENDED', 'PENDING_ACTIVATION']) {
      const h = harness();
      const membership = { id: 'actor', eventId: 'otro', role, accountStatus };
      h.req.auth = { memberships: [membership] };
      let next = false;
      h.middleware.requireSuperAdmin(h.req, h.res, () => { next = true; });
      const allowed = role.trim().toUpperCase() === 'ADMIN_TECH' && accountStatus === 'ACTIVE';
      assert.equal(next, allowed);
      assert.equal(h.res.statusCode, allowed ? 200 : 403);
      assert.equal(h.req.auth.currentMembership, allowed ? membership : undefined);
    }
  }
});

test('moderacion exige admin o MODERATOR activo del evento resuelto', async () => {
  for (const role of ['ADMIN_MUN', 'ADMIN_TECH', 'MODERATOR', ' moderator ', 'PARTICIPANT', 'MODERADOR', 'XMODERATOR']) {
    for (const eventId of ['event', 'otro']) {
      for (const accountStatus of ['ACTIVE', 'SUSPENDED', 'PENDING_ACTIVATION']) {
        const h = harness();
        const membership = { id: 'actor', eventId, role, accountStatus };
        h.req.auth = { memberships: [membership] };
        let next = false;
        await h.middleware.requireEventModerator(async () => 'event')(h.req, h.res, () => { next = true; });
        const allowed = ['ADMIN_MUN', 'ADMIN_TECH', 'MODERATOR'].includes(role.trim().toUpperCase()) && eventId === 'event' && accountStatus === 'ACTIVE';
        assert.equal(next, allowed);
        assert.equal(h.res.statusCode, allowed ? 200 : 403);
        assert.equal(h.req.auth.currentMembership, allowed ? membership : undefined);
      }
    }
  }
});

test('moderador no administra cuentas, comites, roles ni eventos', async () => {
  const h = harness({ memberships: [{ eventId: 'event', role: 'MODERATOR', accountStatus: 'ACTIVE' }] });
  await h.run();
  assert.equal(h.res.statusCode, 403);
  assert.equal(h.nextCalls, 0);
  h.middleware.requireAdmin(h.req, h.res, () => assert.fail('No debe listar eventos'));
  assert.equal(h.res.statusCode, 403);
  const source = fs.readFileSync(__dirname + '/../routes/admin.routes.ts', 'utf8');
  for (const path of ['/create-account', '/participants/:membershipId/committee', '/participants/:membershipId/role']) {
    const line = source.split('\n').find(line => line.includes(`'${path}'`));
    assert.match(line ?? '', /requireEventAdmin|requireMembershipEventAdmin/);
  }
});

test('moderacion conserva missingStatus y maneja errores del resolver', async () => {
  for (const options of [undefined, { missingStatus: 404, missingMessage: 'No encontrado' }]) {
    const h = harness();
    await h.middleware.requireEventModerator(() => null, options)(h.req, h.res, () => assert.fail());
    assert.equal(h.res.statusCode, options?.missingStatus ?? 400);
    if (options) assert.equal(h.res.body.error, options.missingMessage);
  }
  const h = harness();
  await h.middleware.requireEventModerator(() => { throw new Error('simulado'); })(h.req, h.res, () => assert.fail());
  assert.equal(h.res.statusCode, 500);
});
