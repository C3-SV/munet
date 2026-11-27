const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadTs } = require('../test-helpers/load-ts.cjs');
const { fakeSupabase, hasStep } = require('../test-helpers/fake-supabase.cjs');

const row = (role = 'PARTICIPANT', eventStatus = 'ACTIVE', extra = {}) => ({
  id: 'm1', user_id: 'u1', event_id: 'e1', role, committee_id: 'c1',
  participant_code: 'COD1', account_status: 'ACTIVE', created_at: null,
  events: { id: 'e1', name: 'Evento', slug: 'evento', status: eventStatus, deleted_at: null },
  committees: { id: 'c1', name: 'Comité', code: 'COM', deleted_at: null },
  ...extra,
});

function setup({ rpcResult, legacy = {} } = {}) {
  const calls = [];
  const db = fakeSupabase((call) => {
    calls.push(call);
    if (call.table === 'users') return legacy.user ?? { data: { id: 'u1', supabase_auth_user_id: 'auth1', email: 'a@b.com' }, error: null };
    if (call.table === 'event_memberships') return legacy.memberships ?? { data: [row()], error: null };
    throw new Error(`Tabla inesperada: ${call.table}`);
  });
  const rpcCalls = [];
  db.rpc = async (name, args) => { rpcCalls.push({ name, args }); return rpcResult; };
  const service = loadTs(__dirname + '/auth-context.service.ts', {
    '../utils/rbac.utils': { isAdminRole: role => role === 'ADMIN_MUN' || role === 'ADMIN_TECH' },
    '../lib/supabase': { supabaseAdmin: db },
  });
  return { service, calls, rpcCalls };
}

test('contexto de auth usa una RPC y conserva el mapeo de memberships', async () => {
  const h = setup({ rpcResult: { data: { id: 'u1', supabase_auth_user_id: 'auth1', email: 'a@b.com', memberships: [row()] }, error: null } });
  const result = await h.service.getAuthContextBySupabaseAuthId('auth1');

  assert.equal(h.rpcCalls.length, 1);
  assert.equal(h.rpcCalls[0].name, 'get_auth_context_by_supabase_auth_user_id');
  assert.equal(h.rpcCalls[0].args.p_supabase_auth_user_id, 'auth1');
  assert.equal(h.calls.length, 0);
  assert.equal(result.user.id, 'u1');
  assert.deepEqual(JSON.parse(JSON.stringify(result.memberships[0])), {
    id: 'm1', userId: 'u1', eventId: 'e1', eventName: 'Evento', eventSlug: 'evento', eventStatus: 'ACTIVE',
    role: 'PARTICIPANT', committeeId: 'c1', committeeName: 'Comité', committeeCode: 'COM',
    participantCode: 'COD1', accountStatus: 'ACTIVE', createdAt: null,
  });
});

test('contexto de auth filtra eventos eliminados, archivados no-admin y comité eliminado igual que el helper de login', async () => {
  const h = setup({ rpcResult: { data: { id: 'u1', memberships: [
    row('PARTICIPANT', 'ARCHIVED'),
    row('ADMIN_MUN', 'ARCHIVED', { id: 'm2' }),
    row('PARTICIPANT', 'ACTIVE', { id: 'm3', events: { id: 'e2', name: 'Borrado', slug: 'x', status: 'ACTIVE', deleted_at: 'now' } }),
    row('MODERATOR', 'ACTIVE', { id: 'm4', committees: { id: 'c1', name: 'Borrado', code: 'X', deleted_at: 'now' } }),
  ] }, error: null } });

  const result = await h.service.getAuthContextBySupabaseAuthId('auth1');
  assert.deepEqual(result.memberships.map(m => m.id), ['m2', 'm4']);
  assert.equal(result.memberships[1].committeeName, null);
  assert.equal(result.memberships[1].committeeCode, null);
});

test('solo PGRST202 usa las dos consultas legacy y mantiene usuario sin memberships', async () => {
  const h = setup({ rpcResult: { data: null, error: { code: 'PGRST202', message: 'función no encontrada' } }, legacy: { memberships: { data: [], error: null } } });
  const result = await h.service.getAuthContextBySupabaseAuthId('auth1');

  assert.equal(result.user.id, 'u1');
  assert.deepEqual(result.memberships, []);
  assert.equal(h.calls.length, 2);
  assert.ok(h.calls.some(call => call.table === 'users'));
  assert.ok(h.calls.some(call => call.table === 'event_memberships'));
});

test('PGRST200 y errores genéricos no hacen fallback', async () => {
  for (const error of [{ code: 'PGRST200', message: 'relación ausente' }, { code: 'XX000', message: 'db no disponible' }]) {
    const h = setup({ rpcResult: { data: null, error } });
    await assert.rejects(h.service.getAuthContextBySupabaseAuthId('auth1'), /db no disponible|relación ausente/);
    assert.equal(h.calls.length, 0);
  }
});

test('la consulta legacy sigue filtrando membresías activas y no borradas', async () => {
  const h = setup({ rpcResult: { data: null, error: { code: 'PGRST202', message: 'función no encontrada' } } });
  await h.service.getAuthContextBySupabaseAuthId('auth1');
  const memberships = h.calls.find(call => call.table === 'event_memberships');
  assert.ok(hasStep(memberships.steps, 'eq', 'account_status', 'ACTIVE'));
  assert.ok(hasStep(memberships.steps, 'is', 'deleted_at', null));
});

test('la RPC auth usa JOIN left para conservar usuarios sin membresías y queda solo para service_role', () => {
  const sql = fs.readFileSync(__dirname + '/../../../../supabase/migrations/012_contexto_auth.sql', 'utf8');
  assert.match(sql, /left join public\.event_memberships m\s+on m\.user_id = u\.id/);
  assert.match(sql, /m\.account_status = 'ACTIVE'/);
  assert.match(sql, /m\.deleted_at is null/);
  assert.match(sql, /filter \(where m\.id is not null\)/);
  assert.match(sql, /revoke all on function public\.get_auth_context_by_supabase_auth_user_id\(uuid\) from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.get_auth_context_by_supabase_auth_user_id\(uuid\) to service_role/i);
});
