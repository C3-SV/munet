const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('../test-helpers/load-ts.cjs');

const utils = loadTs(__dirname + '/attachments.utils.ts');
const MB = 1024 * 1024;
const EVENT = '11111111-1111-4111-8111-111111111111';
const UPLOAD = '22222222-2222-4222-8222-222222222222';

const meta = (overrides = {}) => ({ fileName: 'acta.pdf', mimeType: 'application/pdf', size: 1000, ...overrides });

test('acepta JPG, PNG y PDF dentro de sus límites', () => {
  assert.equal(utils.validateAttachmentMeta(meta({ mimeType: 'image/jpeg', size: 5 * MB })).ok, true);
  assert.equal(utils.validateAttachmentMeta(meta({ mimeType: 'image/png', size: 1 })).ok, true);
  assert.equal(utils.validateAttachmentMeta(meta({ size: 20 * MB })).ok, true);
});

test('rechaza lo que excede el límite de su tipo', () => {
  assert.equal(utils.validateAttachmentMeta(meta({ mimeType: 'image/jpeg', size: 5 * MB + 1 })).ok, false);
  assert.equal(utils.validateAttachmentMeta(meta({ mimeType: 'image/png', size: 5 * MB + 1 })).ok, false);
  assert.equal(utils.validateAttachmentMeta(meta({ size: 20 * MB + 1 })).ok, false);
});

test('rechaza WebP y otros tipos', () => {
  for (const mimeType of ['image/webp', 'image/gif', 'text/html', 'application/zip', '', undefined, 5]) {
    assert.equal(utils.validateAttachmentMeta(meta({ mimeType })).ok, false, String(mimeType));
  }
});

test('normaliza el tipo declarado a minúsculas', () => {
  const result = utils.validateAttachmentMeta(meta({ mimeType: ' Image/PNG ', size: 10 }));
  assert.equal(result.ok, true);
  assert.equal(result.value.mimeType, 'image/png');
});

test('rechaza tamaños inválidos', () => {
  for (const size of [0, -1, 1.5, NaN, Infinity, '100', null, undefined]) {
    assert.equal(utils.validateAttachmentMeta(meta({ size })).ok, false, String(size));
  }
});

test('rechaza nombres vacíos, largos o con caracteres de control', () => {
  for (const fileName of ['', '   ', 'a'.repeat(256), 'a\nb.pdf', 'a\u0000.pdf', undefined, 7]) {
    assert.equal(utils.validateAttachmentMeta(meta({ fileName })).ok, false, JSON.stringify(fileName));
  }
  assert.equal(utils.validateAttachmentMeta(meta({ fileName: 'a'.repeat(255) })).ok, true);
});

test('reconoce el tipo por la firma del archivo', () => {
  assert.equal(utils.detectAttachmentMime(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])), 'image/jpeg');
  assert.equal(utils.detectAttachmentMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
  assert.equal(utils.detectAttachmentMime(Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])), 'application/pdf');
});

test('no reconoce HTML, texto ni lecturas truncadas', () => {
  assert.equal(utils.detectAttachmentMime(new TextEncoder().encode('<html><body>')), null);
  assert.equal(utils.detectAttachmentMime(new TextEncoder().encode('%PDX-1.7')), null);
  assert.equal(utils.detectAttachmentMime(Uint8Array.from([0xff, 0xd8])), null);
  assert.equal(utils.detectAttachmentMime(new Uint8Array()), null);
});

test('las claves se derivan del evento y del intento', () => {
  assert.equal(utils.buildPendingKey(EVENT, UPLOAD), `pending/${EVENT}/${UPLOAD}`);
  assert.equal(utils.buildFinalKey(EVENT, UPLOAD, 'application/pdf'), `events/${EVENT}/posts/${UPLOAD}.pdf`);
  assert.equal(utils.buildFinalKey(EVENT, UPLOAD, 'image/jpeg'), `events/${EVENT}/posts/${UPLOAD}.jpg`);
  assert.equal(utils.buildFinalKey(EVENT, UPLOAD, 'image/png'), `events/${EVENT}/posts/${UPLOAD}.png`);
});

test('las claves rechazan ids que no son uuid (sin inyección de rutas)', () => {
  assert.throws(() => utils.buildPendingKey('../otro', UPLOAD));
  assert.throws(() => utils.buildPendingKey(EVENT, `${UPLOAD}/../x`));
  assert.throws(() => utils.buildFinalKey(EVENT, 'abc', 'application/pdf'));
});

test('la clave definitiva rechaza tipos no admitidos', () => {
  assert.throws(() => utils.buildFinalKey(EVENT, UPLOAD, 'image/webp'));
});

test('Content-Disposition lleva nombre ASCII de respaldo y nombre UTF-8', () => {
  assert.equal(
    utils.buildContentDisposition('acta.pdf'),
    `inline; filename="acta.pdf"; filename*=UTF-8''acta.pdf`,
  );

  const accented = utils.buildContentDisposition('Resolución 1.pdf');
  assert.match(accented, /filename="Resoluci_n 1\.pdf"/);
  assert.match(accented, /filename\*=UTF-8''Resoluci%C3%B3n%201\.pdf/);
});

test('Content-Disposition neutraliza comillas, barras y saltos de línea', () => {
  const header = utils.buildContentDisposition('a"b\\c\nd.pdf', 'attachment');
  assert.ok(header.startsWith('attachment; filename="a_b_c d.pdf"'));
  assert.ok(!header.includes('\n'));
});

test('isUuid distingue uuids válidos', () => {
  assert.equal(utils.isUuid(EVENT), true);
  assert.equal(utils.isUuid('no-es-uuid'), false);
  assert.equal(utils.isUuid(undefined), false);
});
