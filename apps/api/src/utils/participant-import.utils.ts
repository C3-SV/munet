export const IMPORT_MAX_ROWS = 1000;
export const IMPORT_CONFIRM_BATCH_MAX = 50;
export const IMPORT_TEMPLATE_HEADERS = ['nombre', 'apellido', 'codigo_participante', 'comite', 'delegacion', 'rol', 'alias'];

export type ImportCommittee = { id: string; code: string; name: string; status?: string | null };
export type NormalizedImportRow = {
  row: number; first_name: string; last_name: string; participant_code: string;
  committee_id: string | null; committee_label: string | null;
  delegation_name: string | null; institution_name: string | null;
  role: 'PARTICIPANT' | 'MODERATOR' | 'ADMIN_MUN'; alias: string | null;
  // Comit\u00e9 que no existe en el evento y se crear\u00e1 al confirmar (solo cuando committee_id es null).
  new_committee_name: string | null;
};
type Context = { committees: ImportCommittee[]; existingParticipantCodes: Iterable<string> };
type Values = Record<string, string>;
export const MAX_COMMITTEE_NAME_LENGTH = 120;
export const MAX_NEW_COMMITTEES = 30;
export const foldText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const fold = foldText;

// C\u00f3digo del comit\u00e9 derivado del nombre: may\u00fasculas sin tildes, separado por guiones.
export function committeeCodeFromName(name: string): string {
  const code = fold(name).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
  // Nombres sin letras latinas (p. ej. chino) necesitan un sufijo para no colapsar en el mismo código.
  const hash = [...name].reduce((h, ch) => (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0, 7).toString(36).toUpperCase();
  return code || `COMITE-${hash}`;
}

export function normalizeHeader(h: string): string {
  const key = fold(h.trim()).replace(/[\s-]+/g, '_');
  const groups: Record<string, string[]> = {
    first_name: ['nombre', 'nombres', 'first_name'],
    last_name: ['apellido', 'apellidos', 'last_name'],
    participant_code: ['codigo_participante', 'codigo_de_participante', 'codigo', 'participant_code'],
    committee: ['comite', 'committee', 'committee_code', 'codigo_comite'],
    delegation_name: ['delegacion', 'delegation', 'delegation_name', 'pais'],
    institution_name: ['institucion', 'institution', 'institution_name'],
    role: ['rol', 'role'], alias: ['alias'],
  };
  return Object.keys(groups).find(canonical => groups[canonical].includes(key)) ?? '';
}

export function parseCsv(text: string): string[][] {
  return parseCsvRecords(text).filter(row => row.some(value => value.trim() !== ''));
}

function parseCsvRecords(text: string): string[][] {
  text = text.replace(/^\uFEFF/, '');
  let quoted = false;
  let commas = 0;
  let semicolons = 0;
  // Cuenta separadores fuera de comillas en el primer registro logico.
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') i++;
      else quoted = !quoted;
    } else if (!quoted) {
      if (c === '\r' || c === '\n') break;
      if (c === ',') commas++;
      if (c === ';') semicolons++;
    }
  }
  const delimiter = semicolons > commas ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  quoted = false;
  const finish = () => {
    row.push(cell);
    rows.push(row);
    row = []; cell = '';
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && c === delimiter) {
      row.push(cell); cell = '';
    } else if (!quoted && (c === '\r' || c === '\n')) {
      finish();
      if (c === '\r' && text[i + 1] === '\n') i++;
    } else cell += c;
  }
  if (quoted) throw new Error('CSV invalido: comillas sin cerrar');
  finish();
  return rows;
}

function validateRow(input: Record<string, unknown>, row: number, ctx: Context, confirm: boolean) {
  const errors: string[] = [];
  const read = (key: string, optional = false): string => {
    const value = input[key];
    if (optional && (value === null || value === undefined)) return '';
    if (typeof value !== 'string') { errors.push(`${key} debe ser texto`); return ''; }
    return value.trim();
  };
  const first_name = read('first_name');
  const last_name = read('last_name');
  const participant_code = read('participant_code');
  for (const [label, value] of [['nombre', first_name], ['apellido', last_name]]) {
    if (!value) errors.push(`${label} es obligatorio`);
    if (value.length > 100) errors.push(`${label} supera 100 caracteres`);
  }
  if (!/^[A-Za-z0-9._-]{3,50}$/.test(participant_code)) errors.push('codigo_participante debe tener de 3 a 50 caracteres alfanumericos, punto, guion o guion bajo');
  const alias = read('alias', true) || null;
  const delegation_name = read('delegation_name', true) || null;
  const institution_name = read('institution_name', true) || null;
  for (const [label, value, max] of [ ['alias', alias, 60], ['delegacion', delegation_name, 120], ['institucion', institution_name, 120] ] as const) {
    if (value && value.length > max) errors.push(`${label} supera ${max} caracteres`);
  }
  const roleValue = fold(read('role', !confirm)).toUpperCase().replace(/[\s_-]+/g, ' ').trim();
  let role: NormalizedImportRow['role'] = 'PARTICIPANT';
  if (['MODERATOR', 'MODERADOR', 'MODERADORA'].includes(roleValue)) role = 'MODERATOR';
  else if (['ADMIN MUN', 'ADMINISTRADOR MUN', 'ADMIN', 'ADMINISTRADOR'].includes(roleValue)) role = 'ADMIN_MUN';
  else if (roleValue.includes('TECH') || roleValue.includes('TECNIC')) {
    errors.push('El administrador tecnico no se importa por CSV; se crea uno por uno');
  } else if (!['', 'PARTICIPANT', 'PARTICIPANTE', 'DELEGADO', 'DELEGADA'].includes(roleValue)) {
    errors.push('Rol no permitido en CSV (participante, moderador o administrador MUN)');
  }
  const available = ctx.committees.filter(c => c.status !== 'ARCHIVED');
  let committee: ImportCommittee | undefined;
  let newCommitteeName: string | null = null;
  if (confirm) {
    if (input.committee_id !== null && input.committee_id !== undefined) {
      const id = read('committee_id');
      committee = available.find(c => c.id === id);
      if (!committee) errors.push(`Comite ${id} no existe en el evento o esta archivado`);
    } else {
      newCommitteeName = read('new_committee_name', true) || null;
      if (newCommitteeName && newCommitteeName.length > MAX_COMMITTEE_NAME_LENGTH) errors.push(`comite supera ${MAX_COMMITTEE_NAME_LENGTH} caracteres`);
    }
    if (!Number.isInteger(input.row) || (input.row as number) < 2) errors.push('row debe ser un entero mayor o igual a 2');
    if (input.committee_label !== null && typeof input.committee_label !== 'string') errors.push('committee_label debe ser texto o null');
  } else {
    const label = read('committee', true);
    if (label) {
      const matches = (c: ImportCommittee) => c.code.toLowerCase() === label.toLowerCase() || fold(c.name) === fold(label);
      committee = available.find(matches);
      if (!committee) {
        // Un comité archivado con ese nombre o código bloquea la creación: no se puede reutilizar ni duplicar.
        if (ctx.committees.some(c => c.status === 'ARCHIVED' && matches(c))) errors.push(`Comite ${label} no existe en el evento o esta archivado`);
        else if (label.length > MAX_COMMITTEE_NAME_LENGTH) errors.push(`comite supera ${MAX_COMMITTEE_NAME_LENGTH} caracteres`);
        else if (ctx.committees.some(c => c.code.toLowerCase() === committeeCodeFromName(label).toLowerCase())) {
          errors.push(`El codigo ${committeeCodeFromName(label)} ya lo usa otro comite del evento`);
        }
        else newCommitteeName = label;
      }
    }
  }
  const value: NormalizedImportRow = { row, first_name, last_name, participant_code, committee_id: committee?.id ?? null,
    committee_label: committee?.name ?? newCommitteeName, delegation_name, institution_name, role, alias,
    new_committee_name: committee ? null : newCommitteeName };
  return { value, errors };
}

export function buildImportPreview(text: string, ctx: Context) {
  const result: { error?: string; total_rows: number; valid: NormalizedImportRow[];
    invalid: { row: number; values: Values; errors: string[] }[];
    duplicates: { row: number; values: Values; participant_code: string; reason: 'IN_FILE' | 'IN_EVENT' }[];
    new_committees: string[];
  } = { total_rows: 0, valid: [], invalid: [], duplicates: [], new_committees: [] };
  let records: string[][];
  try { records = parseCsvRecords(text); } catch (error) { return { ...result, error: (error as Error).message }; }
  if (!records.some(cells => cells.some(cell => cell.trim()))) return { ...result, error: 'El CSV esta vacio' };
  const headers = records[0].map(normalizeHeader);
  const data = records.slice(1).map((cells, index) => ({ cells, row: index + 2 })).filter(({ cells }) => cells.some(cell => cell.trim()));
  result.total_rows = data.length;
  const required = { first_name: 'nombre', last_name: 'apellido', participant_code: 'codigo_participante' };
  const missing = Object.entries(required).filter(([key]) => !headers.includes(key)).map(([, label]) => label);
  if (missing.length) return { ...result, error: `Faltan encabezados obligatorios: ${missing.join(', ')}` };
  if (result.total_rows > IMPORT_MAX_ROWS) return { ...result, error: `El CSV supera ${IMPORT_MAX_ROWS} filas de datos` };
  const existing = new Set(Array.from(ctx.existingParticipantCodes, code => code.trim().toLowerCase()));
  const seen = new Set<string>();
  data.forEach(({ cells, row }) => {
    const values: Values = {};
    headers.forEach((key, i) => { if (key) values[key] = cells[i] ?? ''; });
    const { value, errors } = validateRow(values, row, ctx, false);
    const key = value.participant_code.toLowerCase();
    if (errors.length) result.invalid.push({ row, values, errors });
    else if (existing.has(key) || seen.has(key)) result.duplicates.push({ row, values, participant_code: value.participant_code, reason: existing.has(key) ? 'IN_EVENT' : 'IN_FILE' });
    else { seen.add(key); result.valid.push(value); }
  });
  const newNames = new Map<string, string>();
  result.valid.forEach(row => { if (row.new_committee_name && !newNames.has(fold(row.new_committee_name))) newNames.set(fold(row.new_committee_name), row.new_committee_name); });
  result.new_committees = Array.from(newNames.values());
  if (result.new_committees.length > MAX_NEW_COMMITTEES) {
    return { ...result, error: `El CSV crea ${result.new_committees.length} comités nuevos; el máximo por importación es ${MAX_NEW_COMMITTEES}` };
  }
  return result;
}

export function validateConfirmRows(rows: unknown, ctx: Context) {
  const result: { error?: string; valid: NormalizedImportRow[]; invalid: { row: number; participant_code: string | null; errors: string[] }[] } = { valid: [], invalid: [] };
  if (!Array.isArray(rows) || !rows.length || rows.length > IMPORT_CONFIRM_BATCH_MAX) return { ...result, error: `rows debe ser un array de 1 a ${IMPORT_CONFIRM_BATCH_MAX} objetos` };
  const existing = new Set(Array.from(ctx.existingParticipantCodes, code => code.trim().toLowerCase()));
  const seen = new Set<string>();
  rows.forEach((input, index) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      result.invalid.push({ row: index + 2, participant_code: null, errors: ['La fila debe ser un objeto'] });
      return;
    }
    const row = Number.isInteger(input.row) && input.row >= 2 ? input.row : index + 2;
    const { value, errors } = validateRow(input, row, ctx, true);
    const key = value.participant_code.toLowerCase();
    if (existing.has(key)) errors.push('codigo_participante ya existe en el evento');
    else if (seen.has(key)) errors.push('codigo_participante repetido en el lote');
    if (errors.length) result.invalid.push({ row, participant_code: value.participant_code || null, errors });
    else { seen.add(key); result.valid.push(value); }
  });
  return result;
}
