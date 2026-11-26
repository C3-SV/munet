const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
require('ts-node').register({ project: 'apps/api/tsconfig.json' });

function compile(file) {
  return ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
}

const utils = { ...require('../utils/profile.utils.ts') };
const controllerCode = compile(__dirname + '/profiles.controller.ts');

// Cola de resultados de Supabase: cada consulta consume el siguiente.
function harness(results = []) {
  const pending = [...results];
  const inserts = [];
  const updates = [];
  const audits = [];
  const unexpected = [];
  const client = { from(table) {
    const call = { table, steps: [] };
    const result = pending.shift();
    if (!result) unexpected.push(table);
    const query = new Proxy({}, { get(_, method) {
      if (method === 'then') return (resolve, reject) => Promise.resolve(result ?? { data: null, error: new Error('sin resultado') }).then(resolve, reject);
      if (method === 'insert') return (values) => { inserts.push({ table, values }); call.steps.push(['insert', values]); return query; };
      if (method === 'update') return (values) => { updates.push(values); call.steps.push(['update', values]); return query; };
      return (...args) => { call.steps.push([method, ...args]); return query; };
    } });
    return query;
  } };
  const module = { exports: {} };
  vm.runInNewContext(controllerCode, { module, exports: module.exports, process: { env: process.env },
    console: { error() {} }, require(name) {
      if (name === '../lib/supabase') return { supabaseAdmin: client };
      if (name === '../utils/audit.logger') return { logAudit: async value => audits.push(value) };
      if (name === '../utils/profile.utils') return utils;
      if (name === '../utils/rbac.utils') return require('../utils/rbac.utils.ts');
      throw new Error(`Import inesperado: ${name}`);
    },
  });
  const res = {
    statusCode: 200, body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  return {
    controller: module.exports, res, inserts, updates, audits,
    done() { assert.deepEqual(unexpected, []); assert.equal(pending.length, 0, 'Consultas pendientes'); },
  };
}

const membership = (profiles = []) => ({
  id: 'm1', event_id: 'event', role: 'ADMIN_TECH', committee_id: null, delegation_name: null,
  institution_name: null, account_status: 'ACTIVE', participant_code: 'ADM-1', delegation_code: null,
  profiles, committees: null, users: { email: 'admin@example.com' },
});
const authed = (body = {}, eventId = 'event') => ({
  body,
  header: name => (name === 'x-event-id' ? eventId : undefined),
  auth: { userId: 'u1', memberships: [{ id: 'm1', eventId: 'event', role: 'ADMIN_TECH', accountStatus: 'ACTIVE' }] },
});
const validBody = { first_name: 'Ana', last_name: 'Perez' };

test('createMyProfile exige x-event-id y nombre y apellido sin consultar', async () => {
  for (const [req, message] of [
    [authed(validBody, ''), /x-event-id/],
    [authed({ last_name: 'Perez' }), /first_name/],
    [authed({ first_name: 'Ana' }), /last_name/],
    [authed({ first_name: 'x'.repeat(101), last_name: 'Perez' }), /first_name/],
  ]) {
    const h = harness();
    await h.controller.createMyProfile(req, h.res);
    assert.equal(h.res.statusCode, 400);
    assert.match(h.res.body.error, message);
    assert.equal(h.inserts.length, 0);
    h.done();
  }
});

test('createMyProfile rechaza alias invalido antes de consultar', async () => {
  const h = harness();
  await h.controller.createMyProfile(authed({ ...validBody, alias: 'x'.repeat(61) }), h.res);
  assert.equal(h.res.statusCode, 400);
  h.done();
});

test('createMyProfile devuelve 404 si la membresia no existe en el evento', async () => {
  const h = harness([{ data: null, error: null }]);
  await h.controller.createMyProfile(authed(validBody), h.res);
  assert.equal(h.res.statusCode, 404);
  assert.equal(h.inserts.length, 0);
  h.done();
});

test('createMyProfile devuelve 409 si ya existe perfil', async () => {
  const h = harness([{ data: membership([{ id: 'p1', first_name: 'Ana', last_name: 'Perez' }]), error: null }]);
  await h.controller.createMyProfile(authed(validBody), h.res);
  assert.equal(h.res.statusCode, 409);
  assert.equal(h.inserts.length, 0);
  h.done();
});

test('createMyProfile crea el perfil propio, audita y devuelve 201', async () => {
  const created = [{ id: 'p1', first_name: 'Ana', last_name: 'Perez', display_name: 'Ana P.', alias: 'Anita', bio: null, profile_image_path: null }];
  const h = harness([
    { data: membership(), error: null },
    { data: null, error: null },
    { data: membership(created), error: null },
  ]);
  await h.controller.createMyProfile(authed({ ...validBody, display_name: 'Ana P.', alias: 'Anita' }), h.res);
  assert.equal(h.res.statusCode, 201);
  assert.equal(h.inserts.length, 1);
  assert.equal(h.inserts[0].table, 'profiles');
  assert.equal(h.inserts[0].values.event_membership_id, 'm1');
  assert.equal(h.inserts[0].values.first_name, 'Ana');
  assert.equal(h.inserts[0].values.alias, 'Anita');
  assert.equal(h.audits.length, 1);
  assert.equal(h.audits[0].reason, 'Perfil propio creado');
  h.done();
});

const patchRequest = (body, role) => ({
  body,
  header: name => (name === 'x-event-id' ? 'event' : undefined),
  auth: { userId: 'u1', memberships: [{ id: 'm1', eventId: 'event', role, accountStatus: 'ACTIVE' }] },
});
const existingProfile = { id: 'p1', first_name: 'Admin', last_name: 'Temporal', display_name: null, alias: null, bio: null, profile_image_path: null };

test('updateMyProfile permite al administrador cambiar su nombre y apellido', async () => {
  const h = harness([
    { data: membership([existingProfile]), error: null },
    { data: null, error: null },
    { data: membership([{ ...existingProfile, first_name: 'Ana', last_name: 'Perez' }]), error: null },
  ]);
  await h.controller.updateMyProfile(patchRequest({ first_name: ' Ana ', last_name: 'Perez' }, 'ADMIN_TECH'), h.res);
  assert.equal(h.res.statusCode, 200);
  const update = h.updates[0];
  assert.equal(update.first_name, 'Ana');
  assert.equal(update.last_name, 'Perez');
  h.done();
});

test('updateMyProfile ignora nombre y apellido de un participante', async () => {
  const h = harness([
    { data: membership([existingProfile]), error: null },
    { data: null, error: null },
    { data: membership([existingProfile]), error: null },
  ]);
  await h.controller.updateMyProfile(patchRequest({ first_name: 'Ana', last_name: 'Perez' }, 'PARTICIPANT'), h.res);
  assert.equal(h.res.statusCode, 200);
  assert.equal(h.updates[0].first_name, 'Admin');
  h.done();
});

test('updateMyProfile rechaza nombre vacio para administrador', async () => {
  const h = harness([{ data: membership([existingProfile]), error: null }]);
  await h.controller.updateMyProfile(patchRequest({ first_name: '  ' }, 'ADMIN_MUN'), h.res);
  assert.equal(h.res.statusCode, 400);
  assert.equal(h.updates.length, 0);
  h.done();
});
