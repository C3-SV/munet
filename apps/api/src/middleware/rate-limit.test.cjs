const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function harness() {
  const module = { exports: {} }, env = {};
  const code = ts.transpileModule(fs.readFileSync(__dirname + '/rate-limit.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, console, process: { env }, require(name) {
    assert.equal(name, 'express-rate-limit');
    return require(name);
  } });
  return { limiters: module.exports, env };
}

async function attempt(limiter, { userId = 'user', ip = '127.0.0.1', code = 'ABC' } = {}) {
  const req = { auth: { userId }, ip, body: { participant_code: code }, headers: {}, app: { get: () => 1 } };
  const res = { statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, setHeader(key, value) { this.headers[key.toLowerCase()] = value; } };
  let passed = false;
  await limiter(req, res, error => { if (error) throw error; passed = true; });
  return { res, passed };
}

test('cada limitador permite N intentos y devuelve 429 JSON con headers draft-7 en N+1', async () => {
  const { limiters } = harness();
  for (const [name, limit] of [['authParticipantLimiter', 10], ['authIpLimiter', 30], ['createPostLimiter', 10], ['createCommentLimiter', 20], ['attachmentInitLimiter', 10], ['sendDmLimiter', 30], ['moderationWriteLimiter', 60]]) {
    for (let i = 0; i < limit; i++) assert.equal((await attempt(limiters[name])).passed, true, name);
    const { res, passed } = await attempt(limiters[name]);
    assert.equal(passed, false, name);
    assert.equal(res.statusCode, 429, name);
    assert.equal(res.body.error, 'Demasiados intentos. Espera un momento e intenta de nuevo.');
    assert.match(res.headers.ratelimit, new RegExp(`limit=${limit}`));
    assert.match(res.headers['ratelimit-policy'], /w=60/);
    assert.ok(res.headers['retry-after']);
    assert.ok(!Object.keys(res.headers).some(key => key.startsWith('x-ratelimit')));
  }
});

test('contadores por usuario ignoran cambios de IP y separan usuarios y acciones', async () => {
  const { limiters } = harness();
  for (let i = 0; i < 10; i++) await attempt(limiters.createPostLimiter, { userId: 'a' });
  assert.equal((await attempt(limiters.createPostLimiter, { userId: 'a', ip: '127.0.0.2' })).res.statusCode, 429);
  assert.equal((await attempt(limiters.createPostLimiter, { userId: 'b' })).passed, true);
  assert.equal((await attempt(limiters.createCommentLimiter, { userId: 'a' })).passed, true);
});

test('autenticacion separa IP+codigo y el cupo por IP impide rotar codigos', async () => {
  const { limiters } = harness();
  for (let i = 0; i < 10; i++) await attempt(limiters.authParticipantLimiter, { code: 'abc' });
  assert.equal((await attempt(limiters.authParticipantLimiter, { code: ' ABC ' })).res.statusCode, 429);
  assert.equal((await attempt(limiters.authParticipantLimiter, { code: 'otro' })).passed, true);
  assert.equal((await attempt(limiters.authParticipantLimiter, { code: 'abc', ip: '127.0.0.2' })).passed, true);
  for (let i = 0; i < 30; i++) assert.equal((await attempt(limiters.authIpLimiter, { code: String(i) })).passed, true);
  assert.equal((await attempt(limiters.authIpLimiter, { code: 'nuevo' })).res.statusCode, 429);
  assert.equal((await attempt(limiters.authIpLimiter, { ip: '127.0.0.2' })).passed, true);
});

test('RATE_LIMIT_DISABLED=true desactiva todos sin consumir contadores', async () => {
  const { limiters, env } = harness();
  env.RATE_LIMIT_DISABLED = 'true';
  for (const limiter of Object.values(limiters)) {
    for (let i = 0; i < 65; i++) {
      const { res, passed } = await attempt(limiter);
      assert.equal(passed, true);
      assert.deepEqual(res.headers, {});
    }
  }
  env.RATE_LIMIT_DISABLED = 'false';
  for (let i = 0; i < 10; i++) assert.equal((await attempt(limiters.createPostLimiter)).passed, true);
  assert.equal((await attempt(limiters.createPostLimiter)).res.statusCode, 429);
  env.RATE_LIMIT_DISABLED = 'true';
  assert.equal((await attempt(limiters.createPostLimiter)).passed, true);
});

test('las rutas montan los limitadores despues de autenticar y solo en escrituras previstas', () => {
  function routes(file) {
    const source = ts.createSourceFile(file, fs.readFileSync(__dirname + '/../routes/' + file, 'utf8'), ts.ScriptTarget.Latest, true);
    const result = new Map();
    function visit(node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(source) === 'router') {
        result.set(`${node.expression.name.text} ${node.arguments[0].text}`, node.arguments.slice(1).map(arg => arg.getText(source)));
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    return result;
  }
  const posts = routes('posts.routes.ts'), dm = routes('dm.routes.ts'), auth = routes('auth.routes.ts'), admin = routes('admin.routes.ts');
  assert.deepEqual(posts.get('post /'), ['requireAuth', 'createPostLimiter', 'createPost']);
  assert.deepEqual(posts.get('post /:postId/comments'), ['requireAuth', 'createCommentLimiter', 'createComment']);
  assert.deepEqual(posts.get('post /attachments/init'), ['requireAuth', 'attachmentInitLimiter', 'initUpload']);
  assert.deepEqual(dm.get('post /conversations/:conversationId/messages'), ['requireAuth', 'sendDmLimiter', 'sendMessage']);
  for (const path of ['login', 'activate']) assert.deepEqual(auth.get(`post /${path}`).slice(0, 2), ['authIpLimiter', 'authParticipantLimiter']);
  const moderationWrites = [...admin].filter(([path]) => path.startsWith('post /moderation/'));
  assert.equal(moderationWrites.length, 5);
  for (const [, handlers] of moderationWrites) {
    assert.equal(handlers[0], 'requireAuth');
    assert.equal(handlers[2], 'moderationWriteLimiter');
  }
  for (const [path, handlers] of [...posts, ...dm, ...admin]) if (path.startsWith('get ')) assert.ok(!handlers.some(h => /Limiter$/.test(h)));
  assert.match(fs.readFileSync(__dirname + '/../server.ts', 'utf8'), /app\.set\('trust proxy', 1\)/);
});
