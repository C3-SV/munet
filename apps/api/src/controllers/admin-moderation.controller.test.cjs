const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function harness(results = []) {
  const calls = [], audits = [];
  const module = { exports: {} };
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
  const code = ts.transpileModule(fs.readFileSync(__dirname + '/admin-moderation.controller.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { exports: module.exports, module, console, require(name) {
    if (name === '../lib/supabase') return { supabaseAdmin: client };
    if (name === '../utils/audit.logger') return { logAudit: async value => audits.push(value) };
    throw new Error(name);
  } });
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  const actor = { id: 'moderator', userId: 'user', eventId: 'event', role: 'MODERATOR' };
  const req = { query: {}, params: { postId: 'post', commentId: 'comment' }, body: { reason: '  Incumple las reglas  ' }, auth: { userId: 'user', currentMembership: actor } };
  return { controller: module.exports, calls, audits, res, req, actor };
}

test('borrar post fijado conserva contenido, desfija y audita actor y autor', async () => {
  const h = harness([{ data: { id: 'post', wall_id: 'wall', status: 'VISIBLE', author_membership_id: 'author', is_pinned: true } }, { data: { id: 'post', status: 'DELETED', is_pinned: false } }]);
  await h.controller.deleteModerationPost(h.req, h.res);
  assert.equal(h.res.statusCode, 200);
  const update = h.calls[1].steps.find(s => s[0] === 'update')[1];
  assert.equal(update.status, 'DELETED');
  assert.equal(update.deleted_by_membership_id, 'ADMIN');
  assert.equal(update.deleted_by_membership_uuid, 'moderator');
  assert.equal(update.is_pinned, false);
  assert.equal(update.pinned_at, null);
  assert.equal(update.pinned_by_membership_id, null);
  assert.ok(!('content' in update));
  assert.ok(h.calls[1].steps.some(s => s[0] === 'eq' && s[1] === 'event_id' && s[2] === 'event'));
  assert.equal(h.audits[0].membership, h.actor);
  assert.equal(h.audits[0].targetMembershipId, 'author');
  assert.equal(h.audits[0].actionType, 'MODERATE_DELETE_POST');
  assert.equal(h.audits[0].reason, 'Incumple las reglas');
});

test('fijados: cupo, visibilidad, idempotencia y auditoria de fijar y desfijar', async () => {
  for (const scenario of [
    { pinned: false, count: 3, code: 409 },
    { pinned: false, count: 2, code: 200, writes: true },
    { pinned: true, code: 200 },
    { pinned: false, status: 'DELETED', code: 409 },
    { pinned: true, unpin: true, code: 200, writes: true },
    { pinned: false, unpin: true, code: 200 },
  ]) {
    const row = { id: 'post', wall_id: 'wall', status: scenario.status ?? 'VISIBLE', author_membership_id: 'author', is_pinned: scenario.pinned, pinned_at: 'original' };
    const results = [{ data: row }];
    if (scenario.count !== undefined) results.push({ count: scenario.count });
    if (scenario.writes) results.push({ data: { ...row, is_pinned: !scenario.unpin } });
    const h = harness(results);
    await h.controller[scenario.unpin ? 'unpinModerationPost' : 'pinModerationPost'](h.req, h.res);
    assert.equal(h.res.statusCode, scenario.code);
    assert.equal(h.audits.length, scenario.writes ? 1 : 0);
    if (scenario.writes) {
      assert.equal(h.audits[0].actionType, scenario.unpin ? 'UNPIN_POST' : 'PIN_POST');
      assert.equal(h.audits[0].targetMembershipId, 'author');
      assert.equal(h.audits[0].membership, h.actor);
      const update = h.calls.at(-1).steps.find(s => s[0] === 'update')[1];
      assert.equal(update.pinned_by_membership_id, scenario.unpin ? null : 'moderator');
      assert.equal(update.is_pinned, !scenario.unpin);
      assert.equal(update.pinned_at === null, !!scenario.unpin);
    } else assert.equal(h.calls.length, scenario.count === undefined ? 1 : 2);
    if (scenario.count !== undefined) {
      for (const [key, value] of [['event_id', 'event'], ['wall_id', 'wall'], ['status', 'VISIBLE'], ['is_pinned', true]]) {
        assert.ok(h.calls[1].steps.some(s => s[0] === 'eq' && s[1] === key && s[2] === value));
      }
    }
  }
});

test('listados de moderacion: muros activos, paginacion, autor y ultimo motivo de borrado', async () => {
  const walls = harness([{ data: [{ id: 'wall', event_id: 'event', wall_type: 'GENERAL', name: 'General', status: 'ACTIVE', committee_id: null }] }, { count: 12 }, { count: 3 }]);
  await walls.controller.listModerationWalls(walls.req, walls.res);
  assert.equal(walls.res.body.walls[0].visible_posts, 12);
  assert.equal(walls.res.body.walls[0].pinned_posts, 3);
  assert.ok(walls.calls[0].steps.some(s => s[0] === 'eq' && s[1] === 'status' && s[2] === 'ACTIVE'));

  const row = { id: 'post', status: 'DELETED', content: 'Contenido original', deleted_by_membership_uuid: 'moderator', author_membership_id: 'author', author: { id: 'author', participant_code: 'ABC', delegation_code: '#123', profiles: [{ first_name: 'Ana', last_name: 'Perez', alias: 'AnaP' }], committees: { id: 'committee', name: 'Consejo', code: 'CS' } } };
  const h = harness([{ data: [row], count: 21 }, { data: { first_name: 'Mod', last_name: 'Uno' } }, { data: { reason: 'Motivo mas reciente' } }, { data: [{ id: 'att', post_id: 'post', file_name: 'acta.pdf', mime_type: 'application/pdf', size_bytes: '2048' }] }]);
  h.req.query = { wall_id: 'wall', status: 'ALL', page: '2', limit: '10' };
  await h.controller.listModerationPosts(h.req, h.res);
  assert.equal(h.res.statusCode, 200);
  assert.equal(h.res.body.posts[0].author.name, 'Ana Perez');
  assert.equal(h.res.body.posts[0].author.alias, 'AnaP');
  assert.equal(h.res.body.posts[0].author.delegation_code, '#123');
  assert.equal(h.res.body.posts[0].deleted_by_name, 'Mod Uno');
  assert.equal(h.res.body.posts[0].deletion_reason, 'Motivo mas reciente');
  assert.equal(h.res.body.posts[0].content, 'Contenido original');
  assert.deepEqual(JSON.parse(JSON.stringify(h.res.body.posts[0].attachment)), { id: 'att', name: 'acta.pdf', mimeType: 'application/pdf', size: 2048 });
  const attachmentsCall = h.calls[3];
  assert.equal(attachmentsCall.table, 'attachments');
  assert.ok(attachmentsCall.steps.some(s => s[0] === 'eq' && s[1] === 'event_id' && s[2] === 'event'));
  assert.ok(attachmentsCall.steps.some(s => s[0] === 'in' && s[1] === 'post_id' && s[2][0] === 'post'));
  assert.deepEqual(JSON.parse(JSON.stringify(h.res.body.pagination)), { page: 2, limit: 10, total: 21, total_pages: 3 });
  assert.ok(h.calls[0].steps.some(s => s[0] === 'range' && s[1] === 10 && s[2] === 19));
  assert.ok(!h.calls[0].steps.some(s => s[0] === 'is' && s[1] === 'deleted_at'));
  assert.deepEqual(h.calls[0].steps.filter(s => s[0] === 'order').map(s => s[1]), ['is_pinned', 'pinned_at', 'created_at', 'id']);
  const audit = h.calls[2];
  assert.equal(audit.table, 'audit_logs');
  for (const [key, value] of [['event_id', 'event'], ['entity_id', 'post'], ['action_type', 'MODERATE_DELETE_POST'], ['outcome', 'SUCCESS']]) assert.ok(audit.steps.some(s => s[0] === 'eq' && s[1] === key && s[2] === value));
  assert.ok(audit.steps.some(s => s[0] === 'order' && s[1] === 'created_at' && s[2].ascending === false));
  assert.ok(audit.steps.some(s => s[0] === 'limit' && s[1] === 1));

  const comments = harness([{ data: [{ id: 'comment', status: 'DELETED', author_membership_id: 'author', author: null }] }, { data: null }]);
  comments.req.query.status = 'DELETED';
  await comments.controller.listModerationComments(comments.req, comments.res);
  assert.equal(comments.res.body.comments[0].deletion_reason, null);
  assert.equal(comments.calls[0].table, 'post_comments');
  assert.ok(comments.calls[0].steps.some(s => s[0] === 'eq' && s[1] === 'post_id' && s[2] === 'post'));
  assert.ok(comments.calls[1].steps.some(s => s[0] === 'eq' && s[1] === 'action_type' && s[2] === 'MODERATE_DELETE_COMMENT'));
});

test('borrado valida reason sin consultar y usa la columna correcta en comentarios', async () => {
  for (const method of ['deleteModerationPost', 'deleteModerationComment']) {
    for (const reason of [undefined, null, {}, ['motivo'], '', ' ab ', 'a'.repeat(501)]) {
      const h = harness();
      h.req.body = { reason };
      await h.controller[method](h.req, h.res);
      assert.equal(h.res.statusCode, 400);
      assert.equal(h.calls.length, 0);
      assert.equal(h.audits.length, 0);
    }
  }
  for (const reason of ['abc', 'a'.repeat(500)]) {
    const h = harness([{ data: { id: 'comment', status: 'VISIBLE', author_membership_id: 'author' } }, { data: { id: 'comment', status: 'DELETED' } }]);
    h.req.body.reason = reason;
    await h.controller.deleteModerationComment(h.req, h.res);
    assert.equal(h.res.statusCode, 200);
    assert.equal(h.res.body.comment.id, 'comment');
    const update = h.calls[1].steps.find(s => s[0] === 'update')[1];
    assert.equal(h.calls[1].table, 'post_comments');
    assert.equal(update.deleted_by_actor_type, 'ADMIN');
    assert.equal(update.deleted_by_membership_uuid, 'moderator');
    assert.ok(!('deleted_by_membership_id' in update));
    assert.ok(!('is_pinned' in update));
    assert.ok(!Number.isNaN(Date.parse(update.deleted_at)));
    assert.equal(h.audits[0].actionType, 'MODERATE_DELETE_COMMENT');
    assert.equal(h.audits[0].targetMembershipId, 'author');
    assert.equal(h.audits[0].membership, h.actor);
  }
});

test('borrado no audita ausencias, repeticion, conflictos ni errores de consulta o escritura', async () => {
  for (const method of ['deleteModerationPost', 'deleteModerationComment']) {
    const row = { id: 'resource', status: 'VISIBLE', author_membership_id: 'author' };
    for (const [results, status] of [
      [[{ data: null }], 404],
      [[{ data: { ...row, status: 'DELETED' } }], 409],
      [[{ error: { message: 'lectura' } }], 500],
      [[{ data: row }, { data: null }], 409],
      [[{ data: row }, { error: { message: 'escritura' } }], 500],
    ]) {
      const h = harness(results);
      await h.controller[method](h.req, h.res);
      assert.equal(h.res.statusCode, status);
      assert.equal(h.audits.length, 0);
    }
  }
});

test('fijado no audita ausencias, errores ni cambios concurrentes y libera su cola', async () => {
  const row = { id: 'post', wall_id: 'wall', status: 'VISIBLE', is_pinned: false };
  for (const [results, status] of [
    [[{ data: null }], 404],
    [[{ error: { message: 'lectura' } }], 500],
    [[{ data: row }, { error: { message: 'conteo' } }], 500],
    [[{ data: row }, { count: null }], 500],
    [[{ data: row }, { count: 2 }, { data: null }], 409],
    [[{ data: row }, { count: 2 }, { error: { message: 'escritura' } }], 500],
  ]) {
    const h = harness([...results, { data: { ...row, is_pinned: true } }]);
    await h.controller.pinModerationPost(h.req, h.res);
    assert.equal(h.res.statusCode, status);
    assert.equal(h.audits.length, 0);
    h.res.statusCode = 200;
    await h.controller.pinModerationPost(h.req, h.res);
    assert.equal(h.res.statusCode, 200);
  }
});

test('dos fijados simultaneos en una instancia comparten el cupo del evento', async () => {
  const row = { id: 'post', wall_id: 'wall', status: 'VISIBLE', is_pinned: false, author_membership_id: 'author' };
  const h = harness([{ data: row }, { count: 2 }, { data: { ...row, is_pinned: true } }, { data: { ...row, id: 'post2' } }, { count: 3 }]);
  const res2 = { ...h.res };
  await Promise.all([
    h.controller.pinModerationPost(h.req, h.res),
    h.controller.pinModerationPost({ ...h.req, params: { postId: 'post2' } }, res2),
  ]);
  assert.equal(h.res.statusCode, 200);
  assert.equal(res2.statusCode, 409);
  assert.equal(h.audits.length, 1);
});

test('listados rechazan filtros invalidos y aplican VISIBLE con pagina 1 y limite 20 por defecto', async () => {
  for (const query of [
    { status: 'INVALID' }, { status: ['VISIBLE'] }, { page: '0' }, { page: '-1' }, { page: '1.5' },
    { page: '1000001' }, { page: '9007199254740993' }, { page: ['1'] }, { limit: '0' }, { limit: '101' }, { limit: {} },
  ]) {
    const h = harness();
    h.req.query = { wall_id: 'wall', ...query };
    await h.controller.listModerationPosts(h.req, h.res);
    assert.equal(h.res.statusCode, 400);
    assert.equal(h.calls.length, 0);
  }
  const h = harness([{ data: [], count: 0 }]);
  h.req.query.wall_id = 'wall';
  await h.controller.listModerationPosts(h.req, h.res);
  assert.equal(h.res.body.pagination.page, 1);
  assert.equal(h.res.body.pagination.limit, 20);
  assert.equal(h.res.body.pagination.total_pages, 0);
  assert.ok(h.calls[0].steps.some(s => s[0] === 'eq' && s[1] === 'status' && s[2] === 'VISIBLE'));
  const comments = harness();
  comments.req.query.status = 'INVALID';
  await comments.controller.listModerationComments(comments.req, comments.res);
  assert.equal(comments.res.statusCode, 400);
});

test('listado de posts: sin adjunto devuelve null y un fallo al leer adjuntos es 500', async () => {
  const noAttachment = harness([{ data: [{ id: 'post', status: 'VISIBLE', author_membership_id: 'author', author: null }], count: 1 }, { data: [] }]);
  noAttachment.req.query.wall_id = 'wall';
  await noAttachment.controller.listModerationPosts(noAttachment.req, noAttachment.res);
  assert.equal(noAttachment.res.statusCode, 200);
  assert.equal(noAttachment.res.body.posts[0].attachment, null);

  const failing = harness([{ data: [{ id: 'post', status: 'VISIBLE', author_membership_id: 'author', author: null }], count: 1 }, { error: { message: 'fallo' } }]);
  failing.req.query.wall_id = 'wall';
  await failing.controller.listModerationPosts(failing.req, failing.res);
  assert.equal(failing.res.statusCode, 500);
});

test('comentarios no se truncan en el primer lote y filtran siempre por evento', async () => {
  const h = harness([{ data: Array.from({ length: 500 }, (_, i) => ({ id: `c${i}`, status: 'VISIBLE', author: null })) }, { data: [{ id: 'ultimo', status: 'VISIBLE', author: null }] }]);
  h.req.query.status = 'ALL';
  await h.controller.listModerationComments(h.req, h.res);
  assert.equal(h.res.body.comments.length, 501);
  assert.equal(h.res.body.comments.at(-1).id, 'ultimo');
  for (const call of h.calls) {
    assert.ok(call.steps.some(s => s[0] === 'eq' && s[1] === 'event_id' && s[2] === 'event'));
    assert.ok(!call.steps.some(s => s[0] === 'eq' && s[1] === 'status'));
  }
  assert.ok(h.calls[1].steps.some(s => s[0] === 'range' && s[1] === 500 && s[2] === 999));
});

test('fallos al listar o cargar el historial devuelven 500 sin aparentar una lista vacia', async () => {
  for (const method of ['listModerationPosts', 'listModerationWalls', 'listModerationComments']) {
    const h = harness([{ error: { message: 'fallo' } }]);
    h.req.query.wall_id = 'wall';
    await h.controller[method](h.req, h.res);
    assert.equal(h.res.statusCode, 500);
  }
  for (const results of [
    [{ data: [{ id: 'post', status: 'DELETED', deleted_by_membership_uuid: 'moderator' }], count: 1 }, { error: { message: 'perfil' } }],
    [{ data: [{ id: 'post', status: 'DELETED' }], count: 1 }, { error: { message: 'auditoria' } }],
  ]) {
    const h = harness(results);
    h.req.query = { wall_id: 'wall', status: 'ALL' };
    await h.controller.listModerationPosts(h.req, h.res);
    assert.equal(h.res.statusCode, 500);
  }
});
