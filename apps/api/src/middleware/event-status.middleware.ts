import type { NextFunction, Request, Response } from 'express';
import type { AuthMembership } from '../types/auth-context';

// Guarda central de solo lectura para eventos cerrados (ADR-007, seccion 2).
// Con el evento en CLOSED se rechazan las escrituras de participantes y moderadores.
// La reapertura la hace un administrador del evento con PATCH /admin/events/:eventId,
// ruta que no pasa por esta guarda. ARCHIVED no entra aqui: sus escrituras siguen sin decidir.
const READ_ONLY_EVENT_STATUSES: readonly string[] = ['CLOSED'];

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Membership del evento sobre el que actua la peticion:
// - rutas de moderacion: requireEventModerator ya fija req.auth.currentMembership desde el recurso;
// - rutas de participante: el evento llega en x-event-id, igual que en sus controladores.
const resolveRequestMembership = (req: Request): AuthMembership | null => {
  const auth = req.auth;
  if (!auth) return null;
  if (auth.currentMembership) return auth.currentMembership;

  const eventId = req.header('x-event-id')?.trim();
  if (!eventId) return null;

  return auth.memberships.find((membership) => membership.eventId === eventId) ?? null;
};

// Responde 403 a las escrituras cuando el evento de la peticion esta cerrado.
// Lee eventStatus de req.auth, que requireAuth recarga en cada peticion; no consulta la base.
// Debe ir despues de requireAuth y, en moderacion, despues de requireEventModerator.
export const requireEventOpenForWrites = (req: Request, res: Response, next: NextFunction) => {
  if (!WRITE_METHODS.has(req.method)) return next();

  if (!req.auth) {
    return res.status(401).json({ error: 'Token de autorizacion requerido' });
  }

  const membership = resolveRequestMembership(req);

  // Sin evento resoluble no hay estado que comprobar: el controlador rechaza la peticion
  // (400 por x-event-id ausente, 403 si no hay membresia en ese evento) antes de escribir.
  if (!membership || !READ_ONLY_EVENT_STATUSES.includes(membership.eventStatus)) {
    return next();
  }

  return res.status(403).json({ error: 'El evento esta cerrado' });
};
