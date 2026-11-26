const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('../test-helpers/load-ts.cjs');
const { fakeSupabase, hasStep } = require('../test-helpers/fake-supabase.cjs');

const NOW = new Date('2026-12-20T12:00:00Z');
const quietConsole = { error() {}, log() {} };

function setup({ purgeRows = [], objects = {}, referenced = [], failDelete = [] } = {}) {
  const calls = [];
  const deleted = [];
  const storage = {
    async list({ prefix }) {
      return { objects: objects[prefix] ?? [], nextToken: null };
    },
    async delete(key) {
      if (failDelete.includes(key)) throw new Error('fallo');
      deleted.push(key);
    },
  };
  const client = fakeSupabase((call) => {
    calls.push(call);
    if (call.op === 'delete') return { error: null };
    if (call.steps.some((s) => s[0] === 'in')) {
      return { data: referenced.map((storage_path) => ({ storage_path })), error: null };
    }
    return { data: purgeRows, error: null };
  });
  const service = loadTs(__dirname + '/attachments.maintenance.ts', {
    '../lib/supabase': { supabaseAdmin: client },
    '../lib/storage': { getFileStorage: () => storage },
  }, { console: quietConsole });
  return { service, calls, deleted };
}

const old = (key) => ({ key, lastModified: new Date('2026-12-01T00:00:00Z') });
const recent = (key) => ({ key, lastModified: new Date('2026-12-20T11:00:00Z') });

test('purga: la consulta excluye retención y solo toma posts eliminados hace más de 30 días', async () => {
  const h = setup({ purgeRows: [{ id: 'a1', storage_path: 'events/e/posts/u.pdf' }] });
  await h.service.purgeDeletedPostAttachments({ apply: false, now: NOW });

  const steps = h.calls[0].steps;
  assert.ok(hasStep(steps, 'eq', 'retention_hold', false));
  assert.ok(hasStep(steps, 'eq', 'posts.status', 'DELETED'));
  const cutoff = steps.find((s) => s[0] === 'lt' && s[1] === 'posts.deleted_at')[2];
  assert.equal(cutoff, '2026-11-20T12:00:00.000Z');
});

test('purga en simulación cuenta y no borra nada', async () => {
  const h = setup({ purgeRows: [{ id: 'a1', storage_path: 'k1' }, { id: 'a2', storage_path: 'k2' }] });
  const result = await h.service.purgeDeletedPostAttachments({ apply: false, now: NOW });
  assert.equal(result.purged, 2);
  assert.deepEqual(h.deleted, []);
  assert.equal(h.calls.some((c) => c.op === 'delete'), false);
});

test('purga aplicada borra primero el objeto y luego la fila', async () => {
  const h = setup({ purgeRows: [{ id: 'a1', storage_path: 'k1' }] });
  const result = await h.service.purgeDeletedPostAttachments({ apply: true, now: NOW });
  assert.equal(result.purged, 1);
  assert.deepEqual(h.deleted, ['k1']);
  assert.ok(h.calls.some((c) => c.op === 'delete' && hasStep(c.steps, 'eq', 'id', 'a1')));
});

test('purga: si falla el objeto, la fila se conserva y se cuenta el fallo', async () => {
  const h = setup({ purgeRows: [{ id: 'a1', storage_path: 'k1' }], failDelete: ['k1'] });
  const result = await h.service.purgeDeletedPostAttachments({ apply: true, now: NOW });
  assert.deepEqual({ ...result }, { purged: 0, failures: 1 });
  assert.equal(h.calls.some((c) => c.op === 'delete'), false);
});

test('huérfanos: ignora lo reciente y lo referenciado por una fila', async () => {
  const h = setup({
    objects: {
      'pending/': [old('pending/e/u1'), recent('pending/e/u2')],
      'events/': [old('events/e/posts/ok.pdf'), old('events/e/posts/huerfano.pdf'), recent('events/e/posts/nuevo.pdf')],
    },
    referenced: ['events/e/posts/ok.pdf'],
  });
  const result = await h.service.removeOrphanObjects({ apply: true, now: NOW });

  assert.equal(result.orphans, 2);
  assert.deepEqual(h.deleted.sort(), ['events/e/posts/huerfano.pdf', 'pending/e/u1']);
});

test('huérfanos en simulación no borra', async () => {
  const h = setup({ objects: { 'pending/': [old('pending/e/u1')] } });
  const result = await h.service.removeOrphanObjects({ apply: false, now: NOW });
  assert.equal(result.orphans, 1);
  assert.deepEqual(h.deleted, []);
});

test('el resumen combina purga y huérfanos', async () => {
  const h = setup({ purgeRows: [{ id: 'a1', storage_path: 'k1' }], objects: { 'pending/': [old('pending/e/u1')] } });
  const summary = await h.service.runAttachmentMaintenance({ apply: false, now: NOW });
  assert.deepEqual({ ...summary }, { dryRun: true, purgedAttachments: 1, orphanObjects: 1, failures: 0 });
});
