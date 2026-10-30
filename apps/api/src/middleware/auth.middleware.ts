import type { NextFunction, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import {
  getMembershipsByUserId,
  getUserBySupabaseAuthId,
} from '../services/auth-context.service';
import { isAdminRole } from '../utils/rbac.utils';

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

// Middleware de contexto por evento.
// Permite identificar la membership activa para el event_id solicitado.
// No hay acceso transversal: incluso un rol admin debe tener su propia
// membership en el evento solicitado (ver ADR-004 / P-01).
export const requireEventMembership = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const eventId =
    req.headers['x-event-id'] ||
    req.body?.event_id ||
    req.query?.event_id;

  if (!eventId || typeof eventId !== 'string') {
    return res.status(400).json({ error: 'event_id es requerido' });
  }

  const memberships = req.auth?.memberships ?? [];

  const membership = memberships.find(
    (m) => m.eventId === eventId
  );

  if (!membership) {
    return res.status(403).json({ error: 'No perteneces a este evento' });
  }

  if (membership.accountStatus !== 'ACTIVE') {
    return res.status(403).json({ error: 'Membership no activa' });
  }

  req.auth!.currentMembership = membership;
  return next();
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

// Middleware de autorizacion administrativa ACOTADA AL EVENTO objetivo.
// A diferencia de requireAdmin (global), exige que la membership admin
// activa pertenezca especificamente al evento resuelto por `resolveEventId`.
// Resuelve P-01/ADR-004 para las rutas que ya operan sobre un evento
// existente; la unica excepcion legitima sin evento objetivo es la creacion
// de un evento nuevo, que sigue usando requireAdmin.
export const requireEventAdmin = (
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
          isAdminRole(m.role) &&
          m.accountStatus === 'ACTIVE'
      );

      if (!membership) {
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

// Middleware de autorización por roles explícitos.
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const membership = req.auth?.currentMembership;

    if (!membership) {
      return res.status(403).json({ error: 'Membership no encontrada' });
    }

    if (!roles.includes(membership.role)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    return next();
  };
};

// Middleware de autorización global: exige al menos una membership activa con rol admin.
// A diferencia de requireRole, no depende de req.auth.currentMembership ni de event_id,
// por eso sirve para rutas admin sin evento en contexto (ej. crear evento nuevo).
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const memberships = req.auth?.memberships ?? [];

  const hasAdminMembership = memberships.some(
    (m) => isAdminRole(m.role) && m.accountStatus === 'ACTIVE'
  );

  if (!hasAdminMembership) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  return next();
};
