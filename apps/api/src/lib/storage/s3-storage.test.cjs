const test = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { loadTs } = require('../../test-helpers/load-ts.cjs');

const apiRequire = createRequire(__dirname + '/../../../package.json');
const clientS3 = apiRequire('@aws-sdk/client-s3');
const presigner = apiRequire('@aws-sdk/s3-request-presigner');

const types = loadTs(__dirname + '/types.ts');
const utils = loadTs(__dirname + '/../../utils/attachments.utils.ts');
const { createS3Storage } = loadTs(
  __dirname + '/s3-storage.ts',
  {
    '@aws-sdk/client-s3': clientS3,
    '@aws-sdk/s3-request-presigner': presigner,
    '../../utils/attachments.utils': utils,
    './types': types,
  },
  { Date, Number, Uint8Array },
);

const config = {
  endpoint: 'https://abc123.r2.cloudflarestorage.com',
  region: 'auto',
  bucket: 'munet-attachments',
  accessKeyId: 'AKIDEXAMPLE',
  secretAccessKey: 'secreto-de-prueba',
  forcePathStyle: false,
};

const KEY = 'pending/e1/u1';

// Cliente falso: registra cada comando y responde con la función dada.
const fakeClient = (handler) => {
  const calls = [];
  return {
    calls,
    client: {
      async send(command) {
        // Copia plana: las entradas nacen en otro contexto y deepStrictEqual compara prototipos.
        calls.push({ name: command.constructor.name, input: { ...command.input } });
        return handler(command);
      },
    },
  };
};

const awsError = (name, status) => Object.assign(new Error(name), { name, $metadata: { httpStatusCode: status } });

// La firma de URL es local: usa el cliente y el presigner reales, sin red.
const realStorage = () => createS3Storage(config);

test('URL de subida: firma tipo y tamaño, expira y no lleva sumas de verificación', async () => {
  const result = await realStorage().presignUpload({
    key: KEY,
    contentType: 'application/pdf',
    contentLength: 12345,
    expiresInSeconds: 300,
  });
  const url = new URL(result.url);

  assert.equal(result.method, 'PUT');
  assert.deepEqual({ ...result.headers }, { 'Content-Type': 'application/pdf' });
  assert.equal(url.hostname, 'munet-attachments.abc123.r2.cloudflarestorage.com');
  assert.equal(url.pathname, '/pending/e1/u1');
  assert.equal(url.searchParams.get('X-Amz-Expires'), '300');
  assert.equal(url.searchParams.get('X-Amz-Algorithm'), 'AWS4-HMAC-SHA256');
  assert.ok(url.searchParams.get('X-Amz-Signature'));

  const signed = url.searchParams.get('X-Amz-SignedHeaders').split(';');
  assert.ok(signed.includes('content-type'), signed.join(';'));
  assert.ok(signed.includes('content-length'), signed.join(';'));
  assert.ok(![...url.searchParams.keys()].some((name) => name.toLowerCase().includes('checksum')));
  assert.ok(result.expiresAt.getTime() > Date.now());
});

test('URL de descarga: nombre y tipo de respuesta fijados, sin credenciales visibles', async () => {
  const result = await realStorage().presignDownload({
    key: 'events/e1/posts/u1.pdf',
    fileName: 'Resolución 1.pdf',
    contentType: 'application/pdf',
    expiresInSeconds: 60,
  });
  const url = new URL(result.url);

  assert.equal(url.searchParams.get('X-Amz-Expires'), '60');
  assert.equal(url.searchParams.get('response-content-type'), 'application/pdf');
  assert.match(url.searchParams.get('response-content-disposition'), /^inline; filename="Resoluci_n 1\.pdf"/);
  assert.ok(!result.url.includes('secreto-de-prueba'));
});

test('head devuelve tamaño y tipo, o null si no existe', async () => {
  const found = fakeClient(() => ({ ContentLength: 42, ContentType: 'image/png' }));
  assert.deepEqual({ ...(await createS3Storage(config, { client: found.client }).head(KEY)) }, { size: 42, contentType: 'image/png' });
  assert.deepEqual(found.calls[0], { name: 'HeadObjectCommand', input: { Bucket: 'munet-attachments', Key: KEY } });

  const missing = fakeClient(() => { throw awsError('NotFound', 404); });
  assert.equal(await createS3Storage(config, { client: missing.client }).head(KEY), null);
});

test('head propaga otros fallos como StorageError UNAVAILABLE', async () => {
  const broken = fakeClient(() => { throw awsError('InternalError', 500); });
  await assert.rejects(createS3Storage(config, { client: broken.client }).head(KEY), (error) => {
    assert.equal(error.code, 'UNAVAILABLE');
    assert.equal(error.name, 'StorageError');
    return true;
  });
});

test('readRange pide el rango y devuelve los bytes', async () => {
  const fake = fakeClient(() => ({ Body: { transformToByteArray: async () => Uint8Array.from([1, 2, 3]) } }));
  const bytes = await createS3Storage(config, { client: fake.client }).readRange(KEY, 0, 7);

  assert.deepEqual([...bytes], [1, 2, 3]);
  assert.equal(fake.calls[0].input.Range, 'bytes=0-7');
});

test('readRange: objeto inexistente es null y rango vacío es arreglo vacío', async () => {
  const missing = fakeClient(() => { throw awsError('NoSuchKey', 404); });
  assert.equal(await createS3Storage(config, { client: missing.client }).readRange(KEY, 0, 7), null);

  const empty = fakeClient(() => { throw awsError('InvalidRange', 416); });
  assert.equal((await createS3Storage(config, { client: empty.client }).readRange(KEY, 0, 7)).length, 0);
});

test('copy codifica el origen con el bucket', async () => {
  const fake = fakeClient(() => ({}));
  await createS3Storage(config, { client: fake.client }).copy('pending/e 1/u1', 'events/e1/posts/u1.pdf');

  assert.deepEqual(fake.calls[0], {
    name: 'CopyObjectCommand',
    input: {
      Bucket: 'munet-attachments',
      Key: 'events/e1/posts/u1.pdf',
      CopySource: 'munet-attachments/pending/e%201/u1',
    },
  });
});

test('copy distingue origen inexistente de falla del servicio', async () => {
  const missing = fakeClient(() => { throw awsError('NoSuchKey', 404); });
  await assert.rejects(createS3Storage(config, { client: missing.client }).copy('a', 'b'), (error) => error.code === 'NOT_FOUND');

  const broken = fakeClient(() => { throw awsError('SlowDown', 503); });
  await assert.rejects(createS3Storage(config, { client: broken.client }).copy('a', 'b'), (error) => error.code === 'UNAVAILABLE');
});

test('delete es idempotente y propaga fallos reales', async () => {
  const gone = fakeClient(() => { throw awsError('NoSuchKey', 404); });
  await createS3Storage(config, { client: gone.client }).delete(KEY);

  const ok = fakeClient(() => ({}));
  await createS3Storage(config, { client: ok.client }).delete(KEY);
  assert.deepEqual(ok.calls[0], { name: 'DeleteObjectCommand', input: { Bucket: 'munet-attachments', Key: KEY } });

  const broken = fakeClient(() => { throw awsError('InternalError', 500); });
  await assert.rejects(createS3Storage(config, { client: broken.client }).delete(KEY), (error) => error.code === 'UNAVAILABLE');
});

test('list devuelve claves, fechas y el token de la siguiente página', async () => {
  const date = new Date('2026-11-01T00:00:00Z');
  const fake = fakeClient(() => ({ Contents: [{ Key: 'pending/e/u1', LastModified: date }, {}], IsTruncated: true, NextContinuationToken: 'tok' }));
  const page = await createS3Storage(config, { client: fake.client }).list({ prefix: 'pending/', maxKeys: 10 });

  assert.deepEqual(page.objects.map((o) => o.key), ['pending/e/u1']);
  assert.equal(page.objects[0].lastModified, date);
  assert.equal(page.nextToken, 'tok');
  assert.deepEqual(fake.calls[0], { name: 'ListObjectsV2Command', input: { Bucket: 'munet-attachments', Prefix: 'pending/', ContinuationToken: undefined, MaxKeys: 10 } });

  const last = fakeClient(() => ({ IsTruncated: false }));
  assert.equal((await createS3Storage(config, { client: last.client }).list({ prefix: 'x/' })).nextToken, null);
});

test('un fallo al firmar se reporta como StorageError', async () => {
  const storage = createS3Storage(config, {
    client: fakeClient(() => ({})).client,
    presign: async () => { throw new Error('boom'); },
  });
  await assert.rejects(
    storage.presignDownload({ key: KEY, fileName: 'a.pdf', contentType: 'application/pdf', expiresInSeconds: 60 }),
    (error) => error.code === 'UNAVAILABLE',
  );
});
