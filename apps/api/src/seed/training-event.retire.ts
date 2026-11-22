import { TRAINING_EVENT } from './training-event.data';

// Reducción del evento de entrenamiento «Conoce MUNET» de 40 a 12 cuentas para entrenar a
// organizadores. Módulo puro: decide qué membresías se conservan y cuáles se retiran, sin tocar la
// base. El script scripts/retire-training-extra-accounts.ts lo usa y escribe solo con --apply.

const prefix = TRAINING_EVENT.codePrefix;
const participants = (from: number, to: number) => {
  const codes: string[] = [];
  for (let n = from; n <= to; n += 1) codes.push(`${prefix}-${String(n).padStart(3, '0')}`);
  return codes;
};

// Las 12 que se quedan: instructor, dos moderadores, seis participantes activos, dos pendientes y una suspendida.
export const KEEP_CODES: readonly string[] = [
  `${prefix}-ADM`,
  `${prefix}-MOD1`,
  `${prefix}-MOD2`,
  ...participants(1, 6),
  ...participants(23, 24),
  ...participants(33, 33),
];

// Las 28 que se retiran: CON-007 a CON-022, CON-025 a CON-032 y CON-034 a CON-037.
export const RETIRE_CODES: readonly string[] = [
  ...participants(7, 22),
  ...participants(25, 32),
  ...participants(34, 37),
];

export const EXPECTED_KEEP = 12;
export const EXPECTED_RETIRE = 28;

const KEEP_SET = new Set(KEEP_CODES);
const RETIRE_SET = new Set(RETIRE_CODES);

export type MembershipWithCode = { participant_code: string | null };

export type RetireSelection<T extends MembershipWithCode> = {
  keep: T[];
  retire: T[];
  // Todo lo que no es una de las 40 cuentas listadas (otro código, código vacío, personas reales...).
  // Nunca se retira.
  unexpected: T[];
  // Códigos de KEEP_CODES que no aparecen entre las membresías recibidas.
  missing: string[];
};

export const selectRetiredAccounts = <T extends MembershipWithCode>(memberships: readonly T[]): RetireSelection<T> => {
  const keep: T[] = [];
  const retire: T[] = [];
  const unexpected: T[] = [];

  for (const membership of memberships) {
    const code = membership.participant_code;
    if (code !== null && KEEP_SET.has(code)) keep.push(membership);
    else if (code !== null && RETIRE_SET.has(code)) retire.push(membership);
    else unexpected.push(membership);
  }

  const present = new Set(keep.map((membership) => membership.participant_code));
  const missing = KEEP_CODES.filter((code) => !present.has(code));

  return { keep, retire, unexpected, missing };
};

// Razones para no escribir nada. Lista vacía = la selección es la esperada.
export const selectionProblems = <T extends MembershipWithCode>(selection: RetireSelection<T>, totalReceived: number): string[] => {
  const problems: string[] = [];
  if (selection.missing.length > 0) {
    problems.push(`Faltan cuentas que deben quedarse: ${selection.missing.join(', ')}`);
  }
  if (selection.keep.length !== EXPECTED_KEEP) {
    problems.push(`Se conservarían ${selection.keep.length} cuentas y deben ser ${EXPECTED_KEEP}`);
  }
  if (selection.retire.length !== EXPECTED_RETIRE) {
    problems.push(`Se retirarían ${selection.retire.length} cuentas y deben ser ${EXPECTED_RETIRE}`);
  }
  const counted = selection.keep.length + selection.retire.length + selection.unexpected.length;
  if (counted !== totalReceived) {
    problems.push(`El conteo no cuadra: ${counted} clasificadas de ${totalReceived} recibidas`);
  }
  return problems;
};
