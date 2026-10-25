import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('ts-node').register({ project: 'apps/api/tsconfig.json' });
const { validateCatalogBody } = require('./admin.validation.ts');

test('rechaza payloads inválidos y ediciones vacías', () => {
  for (const body of [null, [], {}, { name: ' ', slug: 'test' }, { name: 3, slug: 'test' }]) {
    assert.ok(validateCatalogBody(body, 'event'));
  }
  assert.ok(validateCatalogBody({}, 'committee', true));
  assert.ok(validateCatalogBody({ sort_order: 1.5 }, 'committee', true));
});
test('valida fechas reales y orden del rango', () => {
  assert.ok(validateCatalogBody({ start_date: '2026-02-30' }, 'event', true));
  assert.ok(validateCatalogBody({ start_date: '2026-10-12', end_date: '2026-10-11' }, 'event', true));
  assert.equal(validateCatalogBody({ start_date: null, description: null }, 'event', true), null);
});
test('acepta actualizaciones parciales y prioridad cero', () => {
  assert.equal(validateCatalogBody({ name: 'CSNU', code: 'CSNU', event_id: 'event' }, 'committee'), null);
  assert.equal(validateCatalogBody({ sort_order: 0 }, 'committee', true), null);
  assert.equal(validateCatalogBody({ name: 'Evento' }, 'event', true), null);
});
