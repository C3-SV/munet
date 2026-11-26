const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports, extras = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const logs = [];
  vm.runInNewContext(code, { module, exports: module.exports, console: { error: (...args) => logs.push(args.join(' ')) }, Date, ...extras, require(name) {
    assert.ok(name in imports, `Import inesperado: ${name}`);
    return imports[name];
  } });
  return { exports: module.exports, logs };
}

const MB = 1024 * 1024;

// Supabase simulado: cada tabla devuelve sus filas (paginadas con range) y anota las consultas.
function setup({ attachments = [], uploads = [], failTable = null } = {}) {
  const queries = [];
  const supabaseAdmin = { from(table) {
    const ops = [];
    queries.push({ table, ops });
    let range = null;
    const query = new Proxy({}, { get(_, method) {
      if (method === 'then') {
        return (resolve) => {
          if (table === failTable) return resolve({ data: null, error: { message: 'falla' } });
          const rows = table === 'attachments' ? attachments : uploads;
          const [from, to] = range ?? [0, rows.length - 1];
          resolve({ data: rows.slice(from, to + 1), error: null });
        };
      }
      return (...args) => { ops.push([method, ...args]); if (method === 'range') range = args; return query; };
    } });
    return query;
  } };
  const utils = load(__dirname + '/../utils/storage-quota.ts', {}).exports;
  const service = load(__dirname + '/storage-quota.service.ts', { '../lib/supabase': { supabaseAdmin }, '../utils/storage-quota': utils });
  service.exports.resetStorageQuotaCache();
  return { ...service, queries };
}

const rows = (count, size) => Array.from({ length: count }, () => ({ size_bytes: size }));

test('sin STORAGE_QUOTA_BYTES no consulta la base ni bloquea', async () => {
  const { exports, queries } = setup();
  const status = await exports.checkUploadQuota(10 * MB, {});

  assert.equal(status.level, 'disabled');
  assert.equal(queries.length, 0);
});

test('suma lo guardado más los intentos vigentes (solo sin consumir y no vencidos)', async () => {
  const { exports, queries } = setup({ attachments: rows(3, 10 * MB), uploads: rows(2, 5 * MB) });
  const status = await exports.checkUploadQuota(0, { STORAGE_QUOTA_BYTES: String(1000 * MB) });

  assert.equal(status.usedBytes, 40 * MB);
  assert.equal(status.level, 'ok');

  const uploadOps = queries.find((q) => q.table === 'attachment_uploads').ops;
  assert.ok(uploadOps.some((op) => op[0] === 'is' && op[1] === 'consumed_at' && op[2] === null));
  assert.ok(uploadOps.some((op) => op[0] === 'gt' && op[1] === 'expires_at'));
});

test('al 90 % alerta y deja el registro; al 95 % bloquea', async () => {
  const alert = setup({ attachments: rows(1, 91 * MB) });
  assert.equal((await alert.exports.checkUploadQuota(0, { STORAGE_QUOTA_BYTES: String(100 * MB) })).level, 'alert');
  assert.equal(alert.logs.length, 1);
  assert.match(alert.logs[0], /ALERTA ALMACENAMIENTO.*91\.0 %/);

  const blocked = setup({ attachments: rows(1, 96 * MB) });
  const status = await blocked.exports.checkUploadQuota(0, { STORAGE_QUOTA_BYTES: String(100 * MB) });
  assert.equal(status.level, 'blocked');
  assert.match(blocked.logs[0], /bloqueadas \(95 %\)/);
});

test('bloquea la carga que haría pasar el 95 %', async () => {
  const { exports } = setup({ attachments: rows(1, 85 * MB) });

  assert.equal((await exports.checkUploadQuota(5 * MB, { STORAGE_QUOTA_BYTES: String(100 * MB) })).level, 'alert');
  exports.resetStorageQuotaCache();
  assert.equal((await exports.checkUploadQuota(11 * MB, { STORAGE_QUOTA_BYTES: String(100 * MB) })).level, 'blocked');
});

test('la alerta no se repite en cada subida', async () => {
  const { exports, logs } = setup({ attachments: rows(1, 92 * MB) });
  const env = { STORAGE_QUOTA_BYTES: String(100 * MB) };

  await exports.checkUploadQuota(0, env);
  await exports.checkUploadQuota(0, env);
  await exports.checkUploadQuota(0, env);

  assert.equal(logs.length, 1);
});

test('el uso se guarda en memoria unos segundos (una sola medición)', async () => {
  const { exports, queries } = setup({ attachments: rows(1, MB) });
  const env = { STORAGE_QUOTA_BYTES: String(1000 * MB) };

  await exports.checkUploadQuota(0, env);
  const after = queries.length;
  await exports.checkUploadQuota(0, env);

  assert.equal(queries.length, after);
});

test('si no se puede medir, no se bloquea la subida', async () => {
  const { exports, logs } = setup({ failTable: 'attachments' });
  const status = await exports.checkUploadQuota(MB, { STORAGE_QUOTA_BYTES: String(100 * MB) });

  assert.equal(status.level, 'disabled');
  assert.match(logs[0], /No se pudo medir/);
});

test('pagina las consultas cuando hay más de 1000 filas', async () => {
  const { exports, queries } = setup({ attachments: rows(2500, 1) });
  const status = await exports.checkUploadQuota(0, { STORAGE_QUOTA_BYTES: String(1000 * MB) });

  assert.equal(status.usedBytes, 2500);
  assert.equal(queries.filter((q) => q.table === 'attachments').length, 3);
});
