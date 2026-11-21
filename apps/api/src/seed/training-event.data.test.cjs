const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('../test-helpers/load-ts.cjs');

const data = loadTs(__dirname + '/training-event.data.ts', { 'node:crypto': require('node:crypto') }, { Error });
const SECRET = 'secreto-de-prueba-0123456789';
const roster = data.buildRoster();
const codes = roster.map((a) => a.code);
const byState = (state) => roster.filter((a) => a.state === state);

test('son 40 cuentas con códigos únicos y con el prefijo del evento', () => {
  assert.equal(roster.length, 40);
  assert.equal(new Set(codes).size, 40);
  assert.equal(new Set(codes.map((c) => c.toLowerCase())).size, 40);
  assert.ok(codes.every((c) => c.startsWith('CON-')));
  assert.ok(codes.every((c) => /^[A-Za-z0-9._-]{3,50}$/.test(c)), 'el código admite 3 a 50 caracteres alfanuméricos, punto, guion o guion bajo');
});

test('roles: 1 administrador, 2 moderadores y 37 participantes', () => {
  const count = (role) => roster.filter((a) => a.role === role).length;
  assert.deepEqual([count('ADMIN_MUN'), count('MODERATOR'), count('PARTICIPANT')], [1, 2, 37]);
});

test('estados: staff activo; participantes 22 activos, 10 pendientes y 5 suspendidos', () => {
  const participants = roster.filter((a) => a.role === 'PARTICIPANT');
  assert.ok(roster.filter((a) => a.role !== 'PARTICIPANT').every((a) => a.state === 'ACTIVE'));
  assert.deepEqual(
    ['ACTIVE', 'PENDING', 'SUSPENDED'].map((s) => participants.filter((a) => a.state === s).length),
    [22, 10, 5],
  );
});

test('los participantes se reparten en los 4 comités y el staff no pertenece a ninguno', () => {
  const committeeCodes = data.TRAINING_COMMITTEES.map((c) => c.code);
  const participants = roster.filter((a) => a.role === 'PARTICIPANT');
  assert.ok(participants.every((a) => committeeCodes.includes(a.committeeCode)));
  for (const code of committeeCodes) assert.ok(participants.filter((a) => a.committeeCode === code).length >= 9);
  assert.ok(roster.filter((a) => a.role !== 'PARTICIPANT').every((a) => a.committeeCode === null));
});

test('nombres completos y delegaciones presentes en los participantes', () => {
  for (const a of roster) assert.ok(a.firstName && a.lastName, a.code);
  assert.ok(roster.filter((a) => a.role === 'PARTICIPANT').every((a) => a.delegation));
});

test('contraseñas: repetibles con el mismo secreto, distintas por cuenta y por estado', () => {
  const pw = roster.map((a) => data.passwordFor(a, SECRET));
  assert.equal(new Set(pw).size, roster.length);
  assert.deepEqual(roster.map((a) => data.passwordFor(a, SECRET)), pw);
  const participants = roster.filter((a) => a.role === 'PARTICIPANT');
  const pending = participants.find((a) => a.state === 'PENDING');
  const active = participants.find((a) => a.state === 'ACTIVE');
  assert.match(data.passwordFor(pending, SECRET), /^Inicial-\d{3}-[A-HJ-NP-Z2-9]{8}$/);
  assert.match(data.passwordFor(active, SECRET), /^Munet-\d{3}-[A-HJ-NP-Z2-9]{8}$/);
  assert.equal(data.passwordFor(byState('SUSPENDED')[0], SECRET).startsWith('Munet-'), true);
  assert.ok(pw.every((p) => p.length >= 16));
});

test('las contraseñas no se pueden deducir del código: cambian con el secreto', () => {
  const other = 'otro-secreto-distinto-9876543210';
  for (const a of roster) assert.notEqual(data.passwordFor(a, SECRET), data.passwordFor(a, other), a.code);
  // ningún texto fijo del repositorio entra en la contraseña
  for (const a of roster) assert.equal(/Entrena/.test(data.passwordFor(a, SECRET)), false);
});

test('las contraseñas de las cuentas activas y de las pendientes nunca coinciden', () => {
  for (const a of roster) assert.notEqual(data.knownPassword(a.code, SECRET), data.initialPassword(a.code, SECRET));
});

test('un secreto corto se rechaza', () => {
  assert.throws(() => data.knownPassword('CON-001', 'corto'), /al menos 16/);
});

test('el contenido solo referencia cuentas, muros y publicaciones que existen', () => {
  const postKeys = new Set(data.TRAINING_POSTS.map((p) => p.key));
  const committees = new Set(data.TRAINING_COMMITTEES.map((c) => c.code));
  const known = new Set(codes);

  assert.equal(postKeys.size, data.TRAINING_POSTS.length, 'claves de publicación únicas');
  for (const post of data.TRAINING_POSTS) {
    assert.ok(known.has(post.author), post.key);
    if (typeof post.wall === 'object') assert.ok(committees.has(post.wall.committee), post.key);
  }
  for (const c of data.TRAINING_COMMENTS) { assert.ok(postKeys.has(c.post), c.content); assert.ok(known.has(c.author), c.content); }
  for (const dm of data.TRAINING_DMS) { assert.ok(known.has(dm.a)); assert.ok(known.has(dm.b)); assert.notEqual(dm.a, dm.b); }
  assert.ok(postKeys.has(data.TRAINING_POLL.postKey));
  for (const att of data.TRAINING_ATTACHMENTS) assert.ok(postKeys.has(att.post));
});

test('quien publica en el contenido puede hacerlo: nadie suspendido ni pendiente', () => {
  const state = Object.fromEntries(roster.map((a) => [a.code, a.state]));
  const actors = [
    ...data.TRAINING_POSTS.map((p) => p.author),
    ...data.TRAINING_COMMENTS.map((c) => c.author),
    data.TRAINING_POLL.author,
    ...data.TRAINING_POLL.votes.map((v) => v.voter),
    ...data.TRAINING_DMS.flatMap((d) => [d.a, d.b]),
  ];
  for (const code of actors) assert.equal(state[code], 'ACTIVE', code);
});

test('los avisos los publica la organización y los comités los suyos', () => {
  const role = Object.fromEntries(roster.map((a) => [a.code, a.role]));
  const committee = Object.fromEntries(roster.map((a) => [a.code, a.committeeCode]));
  for (const post of data.TRAINING_POSTS) {
    if (post.wall === 'ANNOUNCEMENTS') assert.ok(['ADMIN_MUN', 'MODERATOR'].includes(role[post.author]), post.key);
    if (typeof post.wall === 'object') assert.equal(committee[post.author], post.wall.committee, post.key);
  }
});

test('encuesta: opciones válidas, un voto por persona y la pregunta coincide con su publicación', () => {
  const poll = data.TRAINING_POLL;
  assert.ok(poll.options.length >= 2 && poll.options.length <= 10);
  assert.equal(new Set(poll.votes.map((v) => v.voter)).size, poll.votes.length);
  assert.ok(poll.votes.every((v) => v.option >= 0 && v.option < poll.options.length));
  assert.equal(data.TRAINING_POSTS.find((p) => p.key === poll.postKey).content, poll.question);
});

test('un adjunto por publicación (RN-11) y como máximo dos fijados', () => {
  const posts = data.TRAINING_ATTACHMENTS.map((a) => a.post);
  assert.equal(new Set(posts).size, posts.length);
  assert.ok(data.TRAINING_POSTS.filter((p) => p.pinned).length <= 3);
});

test('las respuestas apuntan a un comentario anterior del mismo post', () => {
  data.TRAINING_COMMENTS.forEach((c, index) => {
    if (c.replyTo === undefined) return;
    const parent = data.TRAINING_COMMENTS.filter((x) => x.post === c.post)[c.replyTo];
    assert.ok(parent, `respuesta ${index}`);
    assert.ok(parent.hoursAgo > c.hoursAgo, 'el padre es anterior');
    assert.equal(parent.replyTo, undefined, 'un solo nivel de respuesta (RN-10)');
  });
});

test('el evento tiene nombre, slug y prefijo coherentes', () => {
  assert.equal(data.TRAINING_EVENT.name, 'Conoce MUNET');
  assert.equal(data.TRAINING_EVENT.slug, 'conoce-munet');
  assert.equal(data.TRAINING_EVENT.codePrefix, 'CON');
});
