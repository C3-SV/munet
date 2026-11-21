const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require(name) {
    assert.ok(name in imports, `Import inesperado: ${name}`);
    return imports[name];
  } });
  return module.exports;
}

const posts = load(__dirname + '/posts.utils.ts', { './walls.utils': { buildWallSlug: () => 'general' } });
const dm = load(__dirname + '/dm.utils.ts', { './posts.utils': posts });

test('el select de mensajes directos pide el alias del perfil', () => {
  assert.match(dm.DM_MEMBERSHIP_SELECT, /alias/);
});

test('mapDmParticipant expone el alias recortado o null', () => {
  const base = { id: 'm1', role: 'PARTICIPANT', committees: null };
  const profile = alias => ({ first_name: 'Ana', last_name: 'Ruiz', display_name: null, alias, profile_image_path: null });
  assert.equal(dm.mapDmParticipant({ ...base, profiles: profile('  Fio ') }).alias, 'Fio');
  assert.equal(dm.mapDmParticipant({ ...base, profiles: profile('   ') }).alias, null);
  assert.equal(dm.mapDmParticipant({ ...base, profiles: profile(null) }).alias, null);
  assert.equal(dm.mapDmParticipant({ ...base, profiles: [profile('Fio')] }).alias, 'Fio');
  assert.equal(dm.mapDmParticipant(null).alias, null);
});
