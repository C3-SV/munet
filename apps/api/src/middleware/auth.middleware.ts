import type { NextFunction, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import {
  getMembershipsByUserId,
  getUserBySupabaseAuthId,
} from '../services/auth-context.service';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        token: string;
        supabaseAuthUserId: string;
        userId: string;
        memberships: any[];
        currentMembership?: any;
      };
    }
  }
}

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

  const globalAdminMembership = memberships.find(
    (m) =>
      (m.role === 'ADMIN_MUN') &&
      m.account_status === 'ACTIVE'
  );

  if (globalAdminMembership) {
    req.auth!.currentMembership = globalAdminMembership;
    return next();
  }

  const membership = memberships.find(
    (m) => m.event_id === eventId
  );

  if (!membership) {
    return res.status(403).json({ error: 'No perteneces a este evento' });
  }

  if (membership.account_status !== 'ACTIVE') {
    return res.status(403).json({ error: 'Membership no activa' });
  }

  req.auth!.currentMembership = membership;
  return next();
};

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