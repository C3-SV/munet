import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('ts-node').register({ project: 'apps/api/tsconfig.json' });
const { parseCsv, normalizeHeader, buildImportPreview, validateConfirmRows, IMPORT_MAX_ROWS, IMPORT_CONFIRM_BATCH_MAX, IMPORT_TEMPLATE_HEADERS } = require('./participant-import.utils.ts');
const ctx = { committees: [
  { id: 'c1', code: 'CS', name: 'Consejo de Seguridad' },
  { id: 'c2', code: 'EC', name: 'Comité Económico' },
  { id: 'c3', code: 'OLD', name: 'Antiguo', status: 'ARCHIVED' },
], existingParticipantCodes: ['EXISTE'] };
const header = 'nombre,apellido,codigo_participante,comite,rol,alias';
const preview = data => buildImportPreview(`${header}\n${data}`, ctx);
const confirmRow = () => preview('Ana,Perez,ABC,CS,,').valid[0];

test('CSV conserva comas, comillas escapadas y saltos dentro de campos', () => {
  assert.deepEqual(parseCsv('a,b\r\n"uno, dos","dice ""hola""\r\ny adios"\r\n,,\n'), [
    ['a', 'b'], ['uno, dos', 'dice "hola"\r\ny adios'],
  ]);
  assert.deepEqual(parseCsv('a,b\n"uno\ndos",tres'), [['a', 'b'], ['uno\ndos', 'tres']]);
});
test('detecta punto y coma, BOM y CRLF', () => {
  assert.deepEqual(parseCsv('\uFEFFa;b\r\n"uno;dos";tres'), [['a', 'b'], ['uno;dos', 'tres']]);
  assert.equal(buildImportPreview('\uFEFFnombres;apellidos;código de participante\r\nAna;Perez;ABC', ctx).valid.length, 1);
});
test('normaliza acentos, espacios, guiones y sinonimos e ignora desconocidos', () => {
  for (const [input, expected] of [[' NÓMBRES ', 'first_name'], ['Apellidos', 'last_name'], ['Código-de participante', 'participant_code'], ['COMITÉ', 'committee'], ['país', 'delegation_name'], ['institución', 'institution_name'], ['Role', 'role'], ['alias', 'alias'], ['extra', '']]) assert.equal(normalizeHeader(input), expected);
  assert.equal(IMPORT_TEMPLATE_HEADERS.join(','), 'nombre,apellido,codigo_participante,comite,delegacion,rol,alias');
});
test('numeracion de Excel y valores originales, incluidos espacios', () => {
  const result = preview(' Ana , Perez , ABC ,,,\n\n ,Perez,DEF,,,');
  assert.equal(result.valid[0].row, 2);
  assert.equal(result.valid[0].first_name, 'Ana');
  assert.equal(result.invalid[0].row, 4);
  assert.equal(result.invalid[0].values.first_name, ' ');
  assert.equal(result.total_rows, 2);
});
test('errores globales dejan listas vacias y nombran encabezados en espanol', () => {
  for (const text of ['', '   ', 'nombre\nAna', `${header}\n${Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, i) => `Ana,Perez,C${i},,,`).join('\n')}`, `${header}\n"sin cerrar`]) {
    const result = buildImportPreview(text, ctx);
    assert.ok(result.error);
    assert.deepEqual([result.valid, result.invalid, result.duplicates], [[], [], []]);
  }
  assert.match(buildImportPreview('nombre\nAna', ctx).error, /apellido, codigo_participante/);
  assert.equal(preview(Array.from({ length: 1000 }, (_, i) => `Ana,Perez,C${i.toString().padStart(3, '0')},,,`).join('\n')).valid.length, 1000);
});
test('roles vacios y sinonimos permitidos; admins y otros roles rechazados', () => {
  for (const role of ['', 'participante', 'DELEGADO', 'delegada', 'PARTICIPANT']) assert.equal(preview(`Ana,Perez,ABC,,${role},`).valid[0].role, 'PARTICIPANT');
  for (const role of ['moderador', 'MODERATOR', 'moderadóra']) assert.equal(preview(`Ana,Perez,ABC,,${role},`).valid[0].role, 'MODERATOR');
  for (const role of ['ADMIN_MUN', 'ADMIN_TECH', 'observador']) assert.ok(preview(`Ana,Perez,ABC,,${role},`).invalid[0].errors.includes('Rol no permitido en CSV (solo participante o moderador; los admins se crean uno por uno)'));
});
test('resuelve comites por codigo o nombre sin acentos, excluye archivados y ajenos', () => {
  for (const label of ['ec', 'comite economico', 'COMITÉ ECONÓMICO']) {
    const value = preview(`Ana,Perez,ABC,${label},,`).valid[0];
    assert.equal(value.committee_id, 'c2');
    assert.equal(value.committee_label, 'Comité Económico');
  }
  assert.equal(preview('Ana,Perez,ABC,,,').valid[0].committee_id, null);
  for (const label of ['OLD', 'Antiguo', 'ajeno']) assert.match(preview(`Ana,Perez,ABC,${label},,`).invalid[0].errors.join(' '), new RegExp(`${label}.*no existe en el evento`));
});
test('duplicados sin distincion de mayusculas y prioridad de validacion', () => {
  const result = preview(' ,Perez,ABC,,,\nAna,Perez,abc,,,\nAna,Perez,ABC,,,\nAna,Perez,existe,,,\n ,Perez,EXISTE,,,');
  assert.equal(result.valid[0].row, 3);
  assert.deepEqual(result.duplicates.map(d => [d.row, d.reason]), [[4, 'IN_FILE'], [5, 'IN_EVENT']]);
  assert.equal(result.invalid.length, 2);
});
test('limites y formatos se comparten entre preview y confirm', () => {
  const base = confirmRow();
  for (const patch of [{ first_name: ' ' }, { last_name: 'x'.repeat(101) }, { first_name: 'x'.repeat(101) }, { participant_code: 'AB' }, { participant_code: 'x'.repeat(51) }, { participant_code: 'A B' }, { alias: 'x'.repeat(61) }, { delegation_name: 'x'.repeat(121) }, { institution_name: 'x'.repeat(121) }, { role: 'ADMIN_TECH' }, { first_name: 2 }]) {
    assert.equal(validateConfirmRows([{ ...base, ...patch }], ctx).invalid.length, 1);
  }
  const text = 'nombre,apellido,codigo,alias,delegacion,institucion\n' + ['x'.repeat(101), 'x'.repeat(101), 'a b', 'x'.repeat(61), 'x'.repeat(121), 'x'.repeat(121)].join(',');
  assert.equal(buildImportPreview(text, ctx).invalid[0].errors.length, 6);
  assert.equal(validateConfirmRows([{ ...base, first_name: 'x'.repeat(100), last_name: 'x'.repeat(100), participant_code: 'x'.repeat(50), alias: 'x'.repeat(60), delegation_name: 'x'.repeat(120), institution_name: 'x'.repeat(120) }], ctx).valid.length, 1);
});
test('confirm valida lote, estructura, comites y duplicados', () => {
  for (const input of [null, {}, [], Array(IMPORT_CONFIRM_BATCH_MAX + 1).fill(confirmRow())]) assert.ok(validateConfirmRows(input, ctx).error);
  for (const input of [null, [], 'fila', { ...confirmRow(), committee_id: 'ajeno' }, { ...confirmRow(), committee_id: 'c3' }, { ...confirmRow(), row: 0 }]) assert.equal(validateConfirmRows([input], ctx).invalid.length, 1);
  const result = validateConfirmRows([confirmRow(), { ...confirmRow(), participant_code: 'abc', row: 3 }, { ...confirmRow(), participant_code: 'existe', row: 4 }], ctx);
  assert.equal(result.valid.length, 1);
  assert.match(result.invalid[0].errors.join(' '), /repetido en el lote/);
  assert.match(result.invalid[1].errors.join(' '), /existe en el evento/);
  assert.equal(validateConfirmRows([{ ...confirmRow(), committee_id: null, committee_label: 'inventado' }], ctx).valid[0].committee_label, null);
});
