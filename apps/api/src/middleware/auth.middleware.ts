import type { NextFunction, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import {
  getMembershipsByUserId,
  getUserBySupabaseAuthId,
} from '../services/auth-context.service';
import { logAudit } from '../utils/audit.logger';
import { canModerateRole, isAdminRole, isSuperAdminRole } from '../utils/rbac.utils';
import type { AuthMembership } from '../types/auth-context';

// Extrae y valida formato "Bearer <token>" del header Authorization.
const readBearerToken = (authorizationHeader?: string | null) => {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token?.trim()) {
    return null;
  }

  return token.trim();
};

// Middleware de autenticación base:
// 1) valida JWT en Supabase
// 2) resuelve usuario interno MUNET
// 3) carga memberships activas y las adjunta en req.auth
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = readBearerToken(req.header('authorization'));

    if (!token) {
      return res.status(401).json({ error: 'Token de autorizacion requerido' });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(
      token
    );

    if (authError || !authData.user?.id) {
      return res.status(401).json({ error: 'Sesion invalida o expirada' });
    }

    const systemUser = await getUserBySupabaseAuthId(authData.user.id);

    if (!systemUser) {
      return res.status(401).json({ error: 'Usuario no registrado en MUNET' });
    }

    const memberships = await getMembershipsByUserId(systemUser.id);

    req.auth = {
      token,
      supabaseAuthUserId: authData.user.id,
      userId: systemUser.id,
      memberships,
    };

    return next();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudo validar la sesion' });
  }
};

// Resuelve el event_id objetivo de una peticion admin a partir de donde
// cada ruta lo transporte hoy (param, body o query). Devuelve null si no
// esta presente.
type EventIdResolver = (
  req: Request
) => string | null | undefined | Promise<string | null | undefined>;

export const eventIdFromParam = (paramName: string): EventIdResolver => (req) => {
  const value = req.params?.[paramName];
  return typeof value === 'string' ? value : null;
};

export const eventIdFromBody: EventIdResolver = (req) => {
  const value = req.body?.event_id;
  return typeof value === 'string' ? value : null;
};

export const eventIdFromQuery: EventIdResolver = (req) => {
  const value = req.query?.event_id;
  return typeof value === 'string' ? value : null;
};

const eventIdFromModerationResource = async (table: 'walls' | 'posts' | 'post_comments', id: unknown) => {
  if (typeof id !== 'string' || !id.trim()) return null;
  let query = supabaseAdmin.from(table).select('event_id').eq('id', id);
  // Posts y comentarios borrados siguen siendo accesibles para consultar su historial.
  if (table === 'walls') query = query.is('deleted_at', null);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data?.event_id ?? null;
};

export const eventIdFromWall: EventIdResolver = (req) => eventIdFromModerationResource('walls', req.query.wall_id);
export const eventIdFromPost: EventIdResolver = (req) => eventIdFromModerationResource('posts', req.params.postId);
export const eventIdFromComment: EventIdResolver = (req) => eventIdFromModerationResource('post_comments', req.params.commentId);

// Resuelve el event_id a partir del comite en la ruta (p.ej. PATCH/DELETE
// /admin/committees/:committeeId), que no trae el evento directamente.
export const eventIdFromCommittee: EventIdResolver = async (req) => {
  const committeeId = req.params?.committeeId;
  if (!committeeId) return null;

  const { data } = await supabaseAdmin
    .from('committees')
    .select('event_id')
    .eq('id', committeeId)
    .is('deleted_at', null)
    .maybeSingle();

  return data?.event_id ?? null;
};

// Resuelve el event_id a partir de la membership en la ruta (p.ej.
// GET/PATCH /admin/participants/:membershipId), que no trae el evento
// directamente.
export const eventIdFromMembership: EventIdResolver = async (req) => {
  const membershipId = req.params?.membershipId;
  if (!membershipId) return null;

  const { data } = await supabaseAdmin
    .from('event_memberships')
    .select('event_id')
    .eq('id', membershipId)
    .is('deleted_at', null)
    .maybeSingle();

  return data?.event_id ?? null;
};

// Ruta registrada para la auditoria de denegaciones, sin query string ni IDs
// de la peticion: solo la plantilla de la ruta (p. ej. "GET /admin/events").
const describeRoute = (req: Request) =>
  `${req.method} ${req.baseUrl ?? ''}${req.route?.path ?? ''}`.trim();

// Registra una denegacion de autorizacion en audit_logs (outcome DENIED).
// Se espera la escritura para que quede antes de responder, pero el 403 se
// envia siempre: logAudit no lanza y el try/catch cubre cualquier excepcion.
// Sin evento ni usuario autenticado no hay a quien atribuir la denegacion.
// Limite contra abuso: cada usuario registra como maximo 10 denegaciones por
// ventana de 10 minutos; las siguientes siguen respondiendo 403 sin escribir
// en audit_logs. El contador vive en memoria (por instancia).
export const DENIAL_AUDIT_LIMIT = 10;
export const DENIAL_AUDIT_WINDOW_MS = 10 * 60 * 1000;
const denialAuditCounters = new Map<string, { count: number; resetAt: number }>();

export const resetDenialAuditCounters = () => denialAuditCounters.clear();

const shouldAuditDenial = (userId: string, now: number) => {
  const entry = denialAuditCounters.get(userId);
  if (!entry || entry.resetAt <= now) {
    denialAuditCounters.set(userId, { count: 1, resetAt: now + DENIAL_AUDIT_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= DENIAL_AUDIT_LIMIT;
};

const auditDenial = async (
  req: Request,
  denial: {
    eventId: string | null;
    actorMembership?: AuthMembership | null;
    requirement: string;
  }
) => {
  const userId = req.auth?.userId;
  const entityId = denial.eventId ?? userId;
  if (!entityId) return;
  if (userId && !shouldAuditDenial(userId, Date.now())) return;

  try {
    await logAudit({
      eventId: denial.eventId,
      actorUserId: userId,
      actorMembershipId: denial.actorMembership?.id,
      actorRole: denial.actorMembership?.role,
      actionType: 'ACCESS_DENIED',
      entityType: denial.eventId ? 'EVENT' : 'ACCOUNT',
      entityId,
      outcome: 'DENIED',
      reason: `Denegado ${describeRoute(req)}: se requiere ${denial.requirement}`,
    });
  } catch (error) {
    console.error('Error registrando denegacion de autorizacion:', error);
  }
};

// Middleware de autorizacion administrativa ACOTADA AL EVENTO objetivo.
// A diferencia de requireAdmin (global), exige que la membership admin
// activa pertenezca especificamente al evento resuelto por `resolveEventId`.
// Resuelve P-01/ADR-004 para las rutas que ya operan sobre un evento
// existente; la unica excepcion legitima sin evento objetivo es la creacion
// de un evento nuevo, que exige requireSuperAdmin.
const requireEventPermission = (
  acceptsRole: (role: string) => boolean,
  requirement: string,
  resolveEventId: EventIdResolver,
  options?: { missingStatus?: number; missingMessage?: string }
) => {
  const missingStatus = options?.missingStatus ?? 400;
  const missingMessage = options?.missingMessage ?? 'event_id es requerido';

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = await resolveEventId(req);

      if (!eventId) {
        return res.status(missingStatus).json({ error: missingMessage });
      }

      const memberships = req.auth?.memberships ?? [];
      const membership = memberships.find(
        (m) =>
          m.eventId === eventId &&
          acceptsRole(m.role) &&
          m.accountStatus === 'ACTIVE'
      );

      if (!membership) {
        await auditDenial(req, {
          eventId,
          actorMembership: memberships.find((m) => m.eventId === eventId) ?? null,
          requirement,
        });
        return res
          .status(403)
          .json({ error: 'No autorizado para administrar este evento' });
      }

      req.auth!.currentMembership = membership;
      return next();
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'No se pudo validar la autorizacion' });
    }
  };
};

export const requireEventAdmin = (
  resolveEventId: EventIdResolver,
  options?: { missingStatus?: number; missingMessage?: string }
) =>
  requireEventPermission(
    isAdminRole,
    'administrador activo del evento',
    resolveEventId,
    options
  );

// Comparte la resolucion de evento para impedir moderacion entre eventos.
export const requireEventModerator = (
  resolveEventId: EventIdResolver,
  options?: { missingStatus?: number; missingMessage?: string }
) =>
  requireEventPermission(
    canModerateRole,
    'moderador o administrador activo del evento',
    resolveEventId,
    options
  );

// Crear eventos requiere superadmin y conserva la membership que autorizo el alta.
export const requireSuperAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const membership = req.auth?.memberships.find(
    (m) => isSuperAdminRole(m.role) && m.accountStatus === 'ACTIVE'
  );
  if (!membership) {
    await auditDenial(req, {
      eventId: null,
      requirement: 'superadministrador activo (ADMIN_TECH)',
    });
    return res.status(403).json({ error: 'No autorizado' });
  }
  req.auth!.currentMembership = membership;
  return next();
};

// Middleware de autorización por roles explícitos.
export const requireRole = (...roles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const membership = req.auth?.currentMembership;
    const requirement = `uno de los roles ${roles.join(', ')}`;

    if (!membership) {
      await auditDenial(req, { eventId: null, requirement });
      return res.status(403).json({ error: 'Membership no encontrada' });
    }

    if (!roles.includes(membership.role)) {
      await auditDenial(req, {
        eventId: membership.eventId,
        actorMembership: membership,
        requirement,
      });
      return res.status(403).json({ error: 'No autorizado' });
    }

    return next();
  };
};

// Middleware de autorización global: exige al menos una membership activa con rol admin.
// A diferencia de requireRole, no depende de req.auth.currentMembership ni de event_id,
// por eso sirve para listar los eventos administrados sin evento en contexto.
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const memberships = req.auth?.memberships ?? [];

  const hasAdminMembership = memberships.some(
    (m) => isAdminRole(m.role) && m.accountStatus === 'ACTIVE'
  );

  if (!hasAdminMembership) {
    await auditDenial(req, {
      eventId: null,
      requirement: 'administrador activo (ADMIN_MUN o ADMIN_TECH) en algun evento',
    });
    return res.status(403).json({ error: 'No autorizado' });
  }

  return next();
};
