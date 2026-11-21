const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

// H4: los UPDATE por id de comentarios y mensajes directos también van acotados al evento
// (defensa en profundidad: el recurso ya se valida por evento antes de escribir).
// Normaliza saltos de línea: en Windows los archivos pueden tener CRLF.
const read = (file) => fs.readFileSync(__dirname + '/' + file, 'utf8').replace(/\r\n/g, '\n');
// Devuelve la cadena de consulta que empieza en `marker` y termina antes de la siguiente
// sentencia (un `if` o un `await` de primer nivel). No se corta en `;` porque puede haber
// comentarios con punto y coma dentro de la cadena.
const chainAfter = (source, marker) => {
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `no se encontró: ${marker}`);
  const rest = source.slice(start + marker.length);
  const next = rest.search(/\n  (if \(|await )/);
  assert.ok(next >= 0, 'no se encontró el final de la cadena');
  return source.slice(start, start + marker.length + next);
};

test('eliminar un comentario filtra el UPDATE por event_id', () => {
  const chain = chainAfter(read('comments.service.ts'), ".from('post_comments')\n    .update(");
  assert.match(chain, /\.eq\('id', params\.commentId\)/);
  assert.match(chain, /\.eq\('event_id', params\.eventId\)/);
});

test('eliminar un mensaje directo filtra el UPDATE por event_id', () => {
  const chain = chainAfter(read('dm.service.ts'), ".from('dm_messages')\n    .update(");
  assert.match(chain, /\.eq\('id', params\.messageId\)/);
  assert.match(chain, /\.eq\('event_id', params\.eventId\)/);
});

test('actualizar last_message_at de la conversación filtra por event_id', () => {
  const chain = chainAfter(read('dm.service.ts'), ".from('dm_conversations')\n    .update({ last_message_at");
  assert.match(chain, /\.eq\('id', params\.conversationId\)/);
  assert.match(chain, /\.eq\('event_id', params\.eventId\)/);
});

test('requireEventMembership ya no existe (H3: no tenía consumidores)', () => {
  assert.equal(read('../middleware/auth.middleware.ts').includes('requireEventMembership'), false);
});
