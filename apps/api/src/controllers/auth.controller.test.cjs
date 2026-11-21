const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('../test-helpers/load-ts.cjs');
const { fakeSupabase } = require('../test-helpers/fake-supabase.cjs');

const quiet = (logs) => ({ error: (...args) => logs.push(args), log() {} });

// Activación: compensación cuando falla a medias (Q02-4). Login: telemetría que no rompe el acceso (Q02-5).
function setup({ db = () => undefined, deleteUserError = null, signIn } = {}) {
  const logs = [];
  const attempts = [];
  const authCalls = { deleted: [], created: [] };
  const writes = [];
  const client = fakeSupabase((call) => {
    if (call.op !== 'select') writes.push({ table: call.table, op: call.op, payload: call.payload });
    return db(call);
  });
  client.auth = {
    admin: {
      createUser: async (input) => { authCalls.created.push(input.email); return { data: { user: { id: 'auth1' } }, error: null }; },
      deleteUser: async (id) => { authCalls.deleted.push(id); return { error: deleteUserError }; },
    },
  };
  const controller = loadTs(__dirname + '/auth.controller.ts', {
    bcrypt: { compare: async () => true },
    '../lib/supabase': {
      supabaseAdmin: client,
      createAuthClient: () => ({ auth: { signInWithPassword: signIn ?? (async () => ({ data: { session: { s: 1 }, user: { id: 'auth1' } }, error: null })) } }),
    },
    '../utils/auth.logger': { logAuthAttempt: async (entry) => { attempts.push(entry); } },
    '../services/auth-context.service': { getMembershipsByUserId: async () => [] },
  }, { console: quiet(logs) });
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  return { controller, logs, attempts, authCalls, writes, res };
}

const pending = { id: 'm1', event_id: 'e1', user_id: 'u1', account_status: 'PENDING_ACTIVATION', initial_password_hash: 'hash' };
const body = { participant_code: 'COD1', event_id: 'e1', initial_password: 'Inicial-1', new_password: 'Nueva-123' };

const activationDb = ({ email = null, usersUpdateError = null, membershipUpdateError = null } = {}) => (call) => {
  if (call.table === 'event_memberships' && call.op === 'select') return { data: pending, error: null };
  if (call.table === 'users' && call.op === 'select') return { data: { email }, error: null };
  if (call.table === 'users' && call.op === 'update') {
    const isRevert = call.payload.supabase_auth_user_id === null;
    return { error: isRevert ? null : usersUpdateError };
  }
  if (call.table === 'event_memberships' && call.op === 'update') return { error: membershipUpdateError };
  return undefined;
};

test('activación correcta no borra nada de Auth', async () => {
  const h = setup({ db: activationDb() });
  await h.controller.activateAccount({ body }, h.res);
  assert.equal(h.res.statusCode, 200);
  assert.deepEqual(h.authCalls.deleted, []);
  assert.equal(h.attempts.at(-1).result, 'SUCCESS');
});

test('si falla vincular users, se borra el usuario de Auth creado y no se toca la membresía', async () => {
  const h = setup({ db: activationDb({ usersUpdateError: { message: 'detalle interno de la base' } }) });
  await h.controller.activateAccount({ body }, h.res);
  assert.equal(h.res.statusCode, 500);
  assert.deepEqual(h.authCalls.deleted, ['auth1']);
  assert.equal(h.writes.some((w) => w.table === 'event_memberships'), false);
  assert.equal(JSON.stringify(h.res.body).includes('detalle interno'), false);
  assert.match(h.res.body.error, /contraseña inicial sigue vigente/);
});

test('si falla activar la membresía, se revierte users y se borra el usuario de Auth', async () => {
  const h = setup({ db: activationDb({ email: 'real@correo.com', membershipUpdateError: { message: 'fallo' } }) });
  await h.controller.activateAccount({ body }, h.res);
  assert.equal(h.res.statusCode, 500);
  assert.deepEqual(h.authCalls.deleted, ['auth1']);
  const revert = h.writes.find((w) => w.table === 'users' && w.payload.supabase_auth_user_id === null);
  assert.ok(revert, 'users debe revertirse');
  assert.equal(revert.payload.email, 'real@correo.com');
  assert.equal(h.attempts.at(-1).failure_reason, 'ACTIVATION_ROLLED_BACK');
  assert.equal(h.attempts.some((a) => a.result === 'SUCCESS'), false);
});

test('sin correo previo, la reversión devuelve email a null en vez de dejar el de respaldo', async () => {
  const h = setup({ db: activationDb({ email: null, membershipUpdateError: { message: 'fallo' } }) });
  await h.controller.activateAccount({ body }, h.res);
  const revert = h.writes.find((w) => w.table === 'users' && w.payload.supabase_auth_user_id === null);
  assert.equal(revert.payload.email, null);
});

test('si también falla borrar el usuario de Auth, igual responde 500 y lo registra', async () => {
  const h = setup({ db: activationDb({ membershipUpdateError: { message: 'fallo' } }), deleteUserError: { message: 'no se pudo' } });
  await h.controller.activateAccount({ body }, h.res);
  assert.equal(h.res.statusCode, 500);
  assert.ok(h.logs.some((args) => String(args[0]).includes('Compensacion: no se pudo borrar el usuario de Auth')));
});

// Login
const loginDb = (lastLoginError) => (call) => {
  if (call.table === 'event_memberships' && call.op === 'select') {
    return { data: [{ id: 'm1', event_id: 'e1', user_id: 'u1', account_status: 'ACTIVE' }], error: null };
  }
  if (call.table === 'users' && call.op === 'select') return { data: { id: 'u1', email: 'a@b.com' }, error: null };
  if (call.table === 'event_memberships' && call.op === 'update') return { error: lastLoginError };
  return undefined;
};

test('un fallo al guardar last_login_at no impide el login, pero queda registrado', async () => {
  const h = setup({ db: loginDb({ message: 'fallo de escritura' }) });
  await h.controller.login({ body: { participant_code: 'COD1', password: 'Nueva-123' } }, h.res);
  assert.equal(h.res.statusCode, 200);
  assert.ok(h.res.body.session);
  assert.ok(h.logs.some((args) => String(args[0]).includes('last_login_at') && String(args[1]).includes('fallo de escritura')));
});

test('con last_login_at correcto no se registra ningún error', async () => {
  const h = setup({ db: loginDb(null) });
  await h.controller.login({ body: { participant_code: 'COD1', password: 'Nueva-123' } }, h.res);
  assert.equal(h.res.statusCode, 200);
  assert.deepEqual(h.logs, []);
});
