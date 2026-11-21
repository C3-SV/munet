const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('../test-helpers/load-ts.cjs');
const { fakeSupabase } = require('../test-helpers/fake-supabase.cjs');

function setup(result) {
  const logs = [];
  const inserted = [];
  const client = fakeSupabase((call) => { inserted.push(call.payload); return result; });
  const logger = loadTs(__dirname + '/auth.logger.ts', { '../lib/supabase': { supabaseAdmin: client } }, {
    console: { error: (...args) => logs.push(args), log() {} },
  });
  return { logger, logs, inserted };
}

const attempt = { participant_code: 'COD1', attempt_type: 'LOGIN', result: 'FAILURE', failure_reason: 'INVALID_CREDENTIALS' };

test('registra el intento y no escribe nada en el log si el insert funciona', async () => {
  const h = setup({ error: null });
  await h.logger.logAuthAttempt(attempt);
  assert.equal(h.inserted[0].participant_code, 'COD1');
  assert.ok(h.inserted[0].created_at);
  assert.deepEqual(h.logs, []);
});

test('un error devuelto por supabase se registra en consola sin lanzar (Q02-3)', async () => {
  const h = setup({ error: { message: 'violates foreign key' } });
  await h.logger.logAuthAttempt(attempt);
  assert.equal(h.logs.length, 1);
  assert.match(String(h.logs[0][0]), /auth attempt/);
  assert.equal(h.logs[0][1].error, 'violates foreign key');
  assert.equal(h.logs[0][1].attemptType, 'LOGIN');
  assert.equal(JSON.stringify(h.logs).includes('COD1'), false, 'el código de ingreso no debe ir al log');
});

test('una excepción tampoco interrumpe el flujo principal', async () => {
  const logs = [];
  const client = { from() { throw new Error('caído'); } };
  const logger = loadTs(__dirname + '/auth.logger.ts', { '../lib/supabase': { supabaseAdmin: client } }, { console: { error: (...a) => logs.push(a) } });
  await logger.logAuthAttempt(attempt);
  assert.equal(logs.length, 1);
});
