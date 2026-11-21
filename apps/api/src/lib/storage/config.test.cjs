const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('../../test-helpers/load-ts.cjs');

const types = loadTs(__dirname + '/types.ts');
const { loadStorageConfig } = loadTs(__dirname + '/config.ts', { './types': types });

const valid = {
  STORAGE_ENDPOINT: 'https://abc123.r2.cloudflarestorage.com',
  STORAGE_BUCKET: 'munet-attachments',
  STORAGE_ACCESS_KEY_ID: 'clave-publica',
  STORAGE_SECRET_ACCESS_KEY: 'clave-secreta-de-prueba',
};

test('lee la configuración y aplica valores por defecto', () => {
  assert.deepEqual({ ...loadStorageConfig(valid) }, {
    endpoint: 'https://abc123.r2.cloudflarestorage.com',
    region: 'auto',
    bucket: 'munet-attachments',
    accessKeyId: 'clave-publica',
    secretAccessKey: 'clave-secreta-de-prueba',
    forcePathStyle: false,
  });
});

test('respeta región y path style explícitos', () => {
  const config = loadStorageConfig({ ...valid, STORAGE_REGION: 'us-east-1', STORAGE_FORCE_PATH_STYLE: 'TRUE' });
  assert.equal(config.region, 'us-east-1');
  assert.equal(config.forcePathStyle, true);
});

test('quita rutas y barras finales del endpoint', () => {
  assert.equal(loadStorageConfig({ ...valid, STORAGE_ENDPOINT: 'https://abc.r2.cloudflarestorage.com/' }).endpoint, 'https://abc.r2.cloudflarestorage.com');
});

test('nombra las variables ausentes y nunca imprime valores', () => {
  assert.throws(
    () => loadStorageConfig({ STORAGE_BUCKET: 'b', STORAGE_SECRET_ACCESS_KEY: 'secreto-que-no-debe-salir' }),
    (error) => {
      assert.equal(error.code, 'NOT_CONFIGURED');
      assert.match(error.message, /STORAGE_ENDPOINT/);
      assert.match(error.message, /STORAGE_ACCESS_KEY_ID/);
      assert.doesNotMatch(error.message, /secreto-que-no-debe-salir/);
      return true;
    },
  );
});

test('trata valores en blanco como ausentes', () => {
  assert.throws(() => loadStorageConfig({ ...valid, STORAGE_BUCKET: '   ' }), /STORAGE_BUCKET/);
});

test('rechaza endpoints inválidos o sin https (salvo local)', () => {
  assert.throws(() => loadStorageConfig({ ...valid, STORAGE_ENDPOINT: 'no es url' }), /URL válida/);
  assert.throws(() => loadStorageConfig({ ...valid, STORAGE_ENDPOINT: 'http://abc.example.com' }), /https/);
  assert.equal(loadStorageConfig({ ...valid, STORAGE_ENDPOINT: 'http://localhost:9000' }).endpoint, 'http://localhost:9000');
});
