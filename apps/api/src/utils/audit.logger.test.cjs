const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
require('ts-node').register({ project: 'apps/api/tsconfig.json' });

function harness(result = {}) {
  const rows = [];
  const logs = [];
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(__dirname + '/audit.logger.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, console: { error: (...args) => logs.push(args) }, require(name) {
    assert.equal(name, '../lib/supabase');
    return { supabaseAdmin: { from(table) {
      assert.equal(table, 'audit_logs');
      return { async insert(row) { rows.push(row); if (result instanceof Error) throw result; return result; } };
    } } };
  } });
  return { logAudit: module.exports.logAudit, rows, logs };
}

const action = { eventId: 'event', actionType: 'CHANGE_ROLE', entityType: 'MEMBERSHIP', entityId: 'target', outcome: 'SUCCESS', reason: 'Cambio autorizado' };

test('logAudit separa actor y afectado y prioriza membership para el actor', async () => {
  const h = harness();
  await h.logAudit({ ...action, membership: { id: 'actor', userId: 'actor-user', role: 'ADMIN_MUN' }, actorUserId: 'otro', actorMembershipId: 'otra', actorRole: 'ADMIN_TECH', targetMembershipId: 'target', targetUserId: 'target-user' });
  assert.deepEqual(JSON.parse(JSON.stringify(h.rows[0])), {
    event_id: 'event', actor_user_id: 'actor-user', actor_membership_id: 'actor', actor_role: 'ADMIN_MUN',
    target_membership_id: 'target', target_user_id: 'target-user',
    action_type: 'CHANGE_ROLE', entity_type: 'MEMBERSHIP', entity_id: 'target', outcome: 'SUCCESS', reason: 'Cambio autorizado',
  });
});

test('logAudit conserva fallback de actor y targets nulos cuando no hay persona afectada', async () => {
  const h = harness();
  await h.logAudit({ ...action, actorUserId: 'u1', actorMembershipId: 'm1', actorRole: 'ADMIN_TECH' });
  assert.equal(h.rows[0].actor_user_id, 'u1');
  assert.equal(h.rows[0].actor_membership_id, 'm1');
  assert.equal(h.rows[0].actor_role, 'ADMIN_TECH');
  assert.equal(h.rows[0].target_user_id, null);
  assert.equal(h.rows[0].target_membership_id, null);
  await h.logAudit(action);
  assert.equal(h.rows[1].actor_user_id, null);
});

test('logAudit registra fallos sin propagar errores al controlador', async () => {
  for (const result of [{ error: { message: 'simulado' } }, new Error('simulado')]) {
    const h = harness(result);
    await h.logAudit(action);
    assert.equal(h.logs.length, 1);
  }
});
