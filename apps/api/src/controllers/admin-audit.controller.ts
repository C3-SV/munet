import type { Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { isAdminRole, isSuperAdminRole } from '../utils/rbac.utils';

// Consulta de auditoria por evento (ADR-007). Solo lectura: no lleva guarda de cierre.
// ADMIN_TECH ve el registro completo del evento. ADMIN_MUN ve solo las acciones de cuidado
// general del evento, sin campos tecnicos. audit_logs no tiene ip_address ni user_agent
// (supabase/schema.sql), asi que no se seleccionan; si una migracion los anade, solo deben
// incluirse para ADMIN_TECH.

const LOG_COLUMNS = 'id, created_at, action_type, entity_type, entity_id, outcome, reason, actor_membership_id, actor_role, target_membership_id';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// ISO 8601 con zona horaria obligatoria. Se pasa tal cual al filtro para no perder la precision de microsegundos de created_at.
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})$/i;
// Cursor opaco de next_before: base64url de `${created_at}|${id}` de la ultima fila devuelta.
// Orden created_at desc, id desc: el id desempata filas con el mismo created_at en el borde de pagina.
const CURSOR_MAX_LENGTH = 256;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

// Acciones de cuidado general que ADMIN_MUN puede consultar. Quedan fuera:
// DELETE_DM_MESSAGE (mensajes privados; la moderacion de DM sigue pendiente, B15) y
// DELETE_COMMITTEE (estructura del evento, no cuidado general).
export const CARE_ACTION_TYPES = [
  'MODERATE_DELETE_POST', 'MODERATE_DELETE_COMMENT', 'MODERATE_DELETE_ATTACHMENT',
  'DELETE_POST', 'DELETE_COMMENT', 'DELETE_ATTACHMENT',
  'PIN_POST', 'UNPIN_POST',
  'SUSPEND_ACCOUNT', 'REACTIVATE_ACCOUNT', 'RESET_PASSWORD',
  'ACCESS_DENIED',
] as const;
// Prefijos para las acciones de ocultar sin borrar (aun no existen en AuditActionType).
export const CARE_ACTION_PREFIXES = ['HIDE_', 'UNHIDE_'] as const;
const CARE_FILTER = [
  `action_type.in.(${CARE_ACTION_TYPES.join(',')})`,
  ...CARE_ACTION_PREFIXES.map(prefix => `action_type.like.${prefix}*`),
].join(',');

type AuditLogRow = {
  id: string;
  created_at: string;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  outcome: string;
  reason: string | null;
  actor_membership_id: string | null;
  actor_role: string | null;
  target_membership_id: string | null;
};

const parseLimit = (value: unknown): number | null => {
  if (value === undefined) return DEFAULT_LIMIT;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number <= MAX_LIMIT ? number : null;
};

const isIsoWithOffset = (value: string) => ISO_WITH_OFFSET.test(value) && !Number.isNaN(Date.parse(value));

type AuditCursor = { createdAt: string; id: string };

const encodeCursor = (log: { created_at: string; id: string }) =>
  Buffer.from(`${log.created_at}|${log.id}`, 'utf8').toString('base64url');

// Devuelve null si el valor no es un cursor generado por encodeCursor.
const decodeCursor = (value: string): AuditCursor | null => {
  if (value.length > CURSOR_MAX_LENGTH || !BASE64URL_PATTERN.test(value)) return null;
  const parts = Buffer.from(value, 'base64url').toString('utf8').split('|');
  if (parts.length !== 2) return null;
  const [createdAt, id] = parts;
  if (!isIsoWithOffset(createdAt) || !UUID_PATTERN.test(id)) return null;
  return { createdAt, id };
};

// Serializa solo las columnas permitidas: lo que no esta en la lista nunca sale de la API.
const toLog = (row: AuditLogRow) => ({
  id: row.id,
  created_at: row.created_at,
  action_type: row.action_type,
  entity_type: row.entity_type,
  entity_id: row.entity_id,
  outcome: row.outcome,
  reason: row.reason,
  actor_membership_id: row.actor_membership_id,
  actor_role: row.actor_role,
  target_membership_id: row.target_membership_id,
});

export const listAuditLogs = async (req: Request, res: Response) => {
  const eventId = req.query.event_id;
  if (typeof eventId !== 'string' || !UUID_PATTERN.test(eventId)) {
    return res.status(400).json({ error: 'event_id debe ser un UUID' });
  }
  const limit = parseLimit(req.query.limit);
  if (limit === null) {
    return res.status(400).json({ error: `limit debe ser un entero entre 1 y ${MAX_LIMIT}` });
  }
  // before acepta el cursor de next_before o una fecha ISO 8601 con zona horaria (compatibilidad, solo created_at).
  const before = req.query.before;
  let beforeIso: string | undefined;
  let cursor: AuditCursor | null = null;
  if (before !== undefined) {
    const invalidBefore = () => res.status(400).json({ error: 'before debe ser un cursor de next_before o una fecha ISO 8601 con zona horaria, por ejemplo 2026-11-22T10:00:00Z' });
    if (typeof before !== 'string') return invalidBefore();
    if (isIsoWithOffset(before)) {
      beforeIso = before;
    } else {
      cursor = decodeCursor(before);
      if (!cursor) return invalidBefore();
    }
  }
  // requireEventAdmin ya lo exige; se comprueba de nuevo para no depender solo del middleware.
  const membership = req.auth?.currentMembership;
  if (!membership || membership.eventId !== eventId || !isAdminRole(membership.role)) {
    return res.status(403).json({ error: 'No autorizado para consultar la auditoria de este evento' });
  }
  try {
    let query = supabaseAdmin.from('audit_logs').select(LOG_COLUMNS).eq('event_id', eventId);
    if (!isSuperAdminRole(membership.role)) query = query.or(CARE_FILTER);
    // Siguiente fila en orden created_at desc, id desc: created_at menor, o mismo created_at con id menor.
    // Los valores van entre comillas dobles (PostgREST); el cursor ya esta validado y no admite comas ni parentesis.
    if (cursor) query = query.or(`created_at.lt."${cursor.createdAt}",and(created_at.eq."${cursor.createdAt}",id.lt."${cursor.id}")`);
    else if (beforeIso) query = query.lt('created_at', beforeIso);
    // Pide una fila de mas para saber si hay pagina siguiente sin una consulta adicional.
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);
    if (error) throw error;
    const rows = (data ?? []) as unknown as AuditLogRow[];
    const logs = rows.slice(0, limit).map(toLog);
    const hasMore = rows.length > limit;
    return res.json({ logs, next_before: hasMore ? encodeCursor(logs[logs.length - 1]) : null });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudo consultar la auditoria' });
  }
};
