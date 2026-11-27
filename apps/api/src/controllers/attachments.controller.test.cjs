const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('../test-helpers/load-ts.cjs');

const EVENT_A = 'evento-a';
const EVENT_B = 'evento-b';
const quietConsole = { error() {}, log() {} };

function setup() {
  const calls = [];
  const service = {
    initAttachmentUpload: async (params) => { calls.push(['init', params]); return { status: 201, body: { upload: { id: 'u' } } }; },
    getAttachmentDownload: async (params) => { calls.push(['download', params]); return { status: 200, body: { url: 'https://r2.test/get' } }; },
    getAttachmentDownloads: async (params) => { calls.push(['downloads', params]); return { status: 200, body: { items: [] } }; },
    removeAttachment: async (params) => { calls.push(['remove', params]); return { status: 200, body: { removed: true } }; },
  };
  const controller = loadTs(__dirname + '/attachments.controller.ts', { '../services/attachments.service': service }, { console: quietConsole });
  return { controller, calls };
}

function request({ eventId, memberships, params = { postId: 'post' }, body = {}, currentMembership } = {}) {
  return {
    header: (name) => (name === 'x-event-id' ? eventId : undefined),
    auth: { userId: 'user', memberships, currentMembership },
    params,
    body,
  };
}

function response() {
  return {
    statusCode: 200, headers: {}, body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
  };
}

const memberA = { id: 'ma', userId: 'user', eventId: EVENT_A, role: 'PARTICIPANT' };

test('sin x-event-id responde 400 sin llamar al servicio', async () => {
  const h = setup();
  for (const handler of [h.controller.initUpload, h.controller.downloadAttachment, h.controller.downloadAttachments, h.controller.deleteOwnAttachment]) {
    const res = response();
    await handler(request({ memberships: [memberA] }), res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(h.calls.length, 0);
});

test('quien no pertenece al evento del header recibe 403 en cada ruta', async () => {
  const h = setup();
  for (const handler of [h.controller.initUpload, h.controller.downloadAttachment, h.controller.downloadAttachments, h.controller.deleteOwnAttachment]) {
    const res = response();
    await handler(request({ eventId: EVENT_B, memberships: [memberA] }), res);
    assert.equal(res.statusCode, 403);
  }
  assert.equal(h.calls.length, 0);
});

test('usa la membresía del evento solicitado, no otra del mismo usuario', async () => {
  const h = setup();
  const memberB = { id: 'mb', userId: 'user', eventId: EVENT_B, role: 'PARTICIPANT' };
  const res = response();
  await h.controller.downloadAttachment(request({ eventId: EVENT_B, memberships: [memberA, memberB] }), res);
  assert.equal(h.calls[0][1].membership, memberB);
  assert.equal(h.calls[0][1].eventId, EVENT_B);
});

test('las respuestas con URL firmada no se cachean', async () => {
  const h = setup();
  const init = response();
  await h.controller.initUpload(request({ eventId: EVENT_A, memberships: [memberA], body: { muro: 'general', file_name: 'a.pdf', mime_type: 'application/pdf', size: 10 } }), init);
  assert.equal(init.headers['cache-control'], 'no-store');
  assert.deepEqual({ ...h.calls[0][1], membership: undefined }, {
    eventId: EVENT_A, membership: undefined, muro: 'general', fileName: 'a.pdf', mimeType: 'application/pdf', size: 10,
  });

  const download = response();
  await h.controller.downloadAttachment(request({ eventId: EVENT_A, memberships: [memberA] }), download);
  assert.equal(download.headers['cache-control'], 'no-store');
});

test('descarga por lote limita la entrada y usa la membresía del evento con no-store', async () => {
  const h = setup();
  const tooMany = response();
  await h.controller.downloadAttachments(request({ eventId: EVENT_A, memberships: [memberA], body: { items: Array(41).fill({}) } }), tooMany);
  assert.equal(tooMany.statusCode, 400);
  assert.equal(h.calls.length, 0);

  const ok = response();
  await h.controller.downloadAttachments(request({ eventId: EVENT_A, memberships: [memberA], body: { items: [{ post_id: 'p', attachment_id: 'a' }] } }), ok);
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.headers['cache-control'], 'no-store');
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0])), ['downloads', { eventId: EVENT_A, membership: memberA, items: [{ post_id: 'p', attachment_id: 'a' }] }]);
});

test('retiro del autor pasa el modo AUTHOR', async () => {
  const h = setup();
  await h.controller.deleteOwnAttachment(request({ eventId: EVENT_A, memberships: [memberA] }), response());
  assert.equal(h.calls[0][1].mode, 'AUTHOR');
});

test('moderación exige motivo de 3 a 500 caracteres y usa el evento de la membresía autorizada', async () => {
  const h = setup();
  const moderator = { id: 'mod', userId: 'user', eventId: EVENT_A, role: 'MODERATOR' };

  for (const reason of [undefined, 'ab', '   ', 'x'.repeat(501), 7]) {
    const res = response();
    await h.controller.deleteModerationAttachment(request({ memberships: [moderator], currentMembership: moderator, body: { reason } }), res);
    assert.equal(res.statusCode, 400, String(reason));
  }
  assert.equal(h.calls.length, 0);

  const res = response();
  await h.controller.deleteModerationAttachment(request({ memberships: [moderator], currentMembership: moderator, body: { reason: '  Contenido no permitido ' } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(h.calls[0][1].mode, 'MODERATION');
  assert.equal(h.calls[0][1].reason, 'Contenido no permitido');
  assert.equal(h.calls[0][1].eventId, EVENT_A);
});

test('un fallo inesperado del servicio responde 500 genérico', async () => {
  const service = { initAttachmentUpload: async () => { throw new Error('detalle interno'); } };
  const controller = loadTs(__dirname + '/attachments.controller.ts', { '../services/attachments.service': { ...service } }, { console: quietConsole });
  const res = response();
  await controller.initUpload(request({ eventId: EVENT_A, memberships: [memberA] }), res);
  assert.equal(res.statusCode, 500);
  assert.equal(JSON.stringify(res.body).includes('detalle interno'), false);
});
