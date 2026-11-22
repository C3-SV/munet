const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('../test-helpers/load-ts.cjs');

const data = loadTs(__dirname + '/training-event.data.ts', { 'node:crypto': require('node:crypto') }, { Error });
const retire = loadTs(__dirname + '/training-event.retire.ts', { './training-event.data': data }, { Error, Set, Map, Array });

// Los arreglos creados dentro del contexto aislado de loadTs no son del mismo realm: se normalizan.
const plain = (value) => JSON.parse(JSON.stringify(value));

const EXPECTED_KEEP = [
  'CON-ADM', 'CON-MOD1', 'CON-MOD2',
  'CON-001', 'CON-002', 'CON-003', 'CON-004', 'CON-005', 'CON-006',
  'CON-023', 'CON-024', 'CON-033',
];
const EXPECTED_RETIRE = [
  ...Array.from({ length: 16 }, (_, i) => `CON-${String(i + 7).padStart(3, '0')}`), // 007 a 022
  ...Array.from({ length: 8 }, (_, i) => `CON-${String(i + 25).padStart(3, '0')}`), // 025 a 032
  ...Array.from({ length: 4 }, (_, i) => `CON-${String(i + 34).padStart(3, '0')}`), // 034 a 037
];

// Membresías como las devuelve la base: una por cuenta del evento, con su código.
const eventMemberships = () =>
  data.buildRoster().map((account, index) => ({ id: `m-${index}`, participant_code: account.code }));

const codesOf = (rows) => plain(rows.map((row) => row.participant_code).sort());

test('las 12 cuentas que se quedan son exactamente las indicadas', () => {
  assert.deepEqual(plain([...retire.KEEP_CODES].sort()), [...EXPECTED_KEEP].sort());
  assert.equal(new Set(retire.KEEP_CODES).size, 12);
});

test('las 28 cuentas que se retiran son exactamente las indicadas', () => {
  assert.deepEqual(plain([...retire.RETIRE_CODES].sort()), [...EXPECTED_RETIRE].sort());
  assert.equal(new Set(retire.RETIRE_CODES).size, 28);
});

test('conservar y retirar son disjuntas y juntas cubren las 40 cuentas del evento', () => {
  const keep = new Set(retire.KEEP_CODES);
  for (const code of retire.RETIRE_CODES) assert.equal(keep.has(code), false, `${code} aparece en ambas listas`);
  const union = [...retire.KEEP_CODES, ...retire.RETIRE_CODES].sort();
  assert.deepEqual(plain(union), plain(data.buildRoster().map((a) => a.code).sort()));
});

test('con el evento completo, se conservan las 12 y se retiran las 28 exactas', () => {
  const selection = retire.selectRetiredAccounts(eventMemberships());
  assert.deepEqual(codesOf(selection.keep), [...EXPECTED_KEEP].sort());
  assert.deepEqual(codesOf(selection.retire), [...EXPECTED_RETIRE].sort());
  assert.deepEqual(plain(selection.unexpected), []);
  assert.deepEqual(plain(selection.missing), []);
  assert.deepEqual(plain(retire.selectionProblems(selection, 40)), []);
});

test('un código que no es de la lista nunca se retira', () => {
  const extras = [
    { id: 'x1', participant_code: 'CON-038' },
    { id: 'x2', participant_code: 'CON-099' },
    { id: 'x3', participant_code: 'REAL-2026-001' },
    { id: 'x4', participant_code: 'con-007' }, // mismo número, otro texto: no es la cuenta listada
    { id: 'x5', participant_code: null },
  ];
  const selection = retire.selectRetiredAccounts([...eventMemberships(), ...extras]);
  assert.deepEqual(codesOf(selection.unexpected), codesOf(extras).sort());
  for (const row of selection.retire) assert.ok(!extras.includes(row), `se retiró ${row.participant_code}`);
  assert.equal(selection.retire.length, 28);
});

test('el conteo total cuadra: conservar + retirar + inesperadas = recibidas', () => {
  const memberships = [...eventMemberships(), { id: 'x', participant_code: 'CON-099' }, { id: 'y', participant_code: null }];
  const selection = retire.selectRetiredAccounts(memberships);
  assert.equal(selection.keep.length + selection.retire.length + selection.unexpected.length, memberships.length);
  assert.equal(selection.unexpected.length, 2);
});

test('si falta una cuenta que debe quedarse, se informa y hay un motivo para no escribir', () => {
  const without = eventMemberships().filter((row) => row.participant_code !== 'CON-033');
  const selection = retire.selectRetiredAccounts(without);
  assert.deepEqual(plain(selection.missing), ['CON-033']);
  const problems = retire.selectionProblems(selection, without.length);
  assert.ok(problems.some((p) => p.includes('CON-033')), problems.join(' | '));
});

test('si falta una cuenta a retirar, la selección no cuadra y se bloquea', () => {
  const without = eventMemberships().filter((row) => row.participant_code !== 'CON-007');
  const selection = retire.selectRetiredAccounts(without);
  const problems = retire.selectionProblems(selection, without.length);
  assert.ok(problems.some((p) => p.includes('27')), problems.join(' | '));
});

test('una cuenta de la lista de conservar no puede aparecer en retirar', () => {
  const selection = retire.selectRetiredAccounts(eventMemberships());
  const retired = new Set(selection.retire.map((row) => row.participant_code));
  for (const code of EXPECTED_KEEP) assert.equal(retired.has(code), false, `${code} se retiraría`);
});
