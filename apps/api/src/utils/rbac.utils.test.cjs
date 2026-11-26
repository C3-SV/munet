const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
require('ts-node').register({ project: 'apps/api/tsconfig.json' });
const rbac = require('./rbac.utils.ts');

test('roles exactos normalizados y compatibilidad de administradores', () => {
  for (const role of ['MODERATOR', ' moderator ']) {
    assert.equal(rbac.isModeratorRole(role), true);
    assert.equal(rbac.canModerateRole(role), true);
    assert.equal(rbac.isAdminRole(role), false);
    assert.equal(rbac.canPublishInAnnouncements(role), false);
  }
  for (const role of [null, undefined, '', 'MODERADOR', 'XMODERATOR', 'PARTICIPANT']) {
    assert.equal(rbac.isModeratorRole(role), false);
    assert.equal(rbac.canModerateRole(role), false);
  }
  for (const role of ['ADMIN_TECH', 'ADMIN_MUN', ' admin_mun ']) {
    assert.equal(rbac.isAdminRole(role), true);
    assert.equal(rbac.canModerateRole(role), true);
    assert.equal(rbac.canPublishInAnnouncements(role), true);
  }
  // Textos antiguos que ya no existen en el enum no dan privilegios.
  for (const role of ['ADMIN', 'COORDINADOR', 'ORGANIZADOR', 'XADMIN_TECH', null, undefined, '']) {
    assert.equal(rbac.isAdminRole(role), false);
  }
  assert.equal(rbac.isSuperAdminRole(' admin_tech '), true);
  for (const role of ['ADMIN_MUN', 'XADMIN_TECH', 'MODERATOR', null]) assert.equal(rbac.isSuperAdminRole(role), false);
});

test('moderador ve todos los muros del evento y no publica en Avisos', () => {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(__dirname + '/../services/walls.service.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require(name) {
    if (name === '../lib/supabase') return { supabaseAdmin: { from() { assert.fail('Sin consultas'); } } };
    if (name === '../utils/rbac.utils') return rbac;
    if (name === '../utils/walls.utils') return require('./walls.utils.ts');
    throw new Error(name);
  } });
  for (const wallType of ['GENERAL', 'ANNOUNCEMENTS', 'COMMITTEE']) {
    const wall = { id: 'wall', event_id: 'event', name: 'Muro', wall_type: wallType, committee_id: wallType === 'COMMITTEE' ? 'otro' : null };
    const view = module.exports.mapWallForMembership(wall, { role: 'MODERATOR', eventId: 'event', committeeId: 'propio' });
    assert.equal(view.canAccess, true);
    assert.equal(view.canPublish, wallType !== 'ANNOUNCEMENTS');
  }
  for (const [membershipCommitteeId, wallCommitteeId, expected] of [['propio', 'otro', false], ['propio', 'propio', true], [null, 'otro', false], [null, null, true]]) {
    assert.equal(rbac.canAccessCommitteeWall({ role: 'PARTICIPANT', membershipCommitteeId, wallCommitteeId }), expected);
  }
});
