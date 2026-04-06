import type { NextFunction, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import {
  getMembershipsByUserId,
  getUserBySupabaseAuthId,
} from '../services/auth-context.service';

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
