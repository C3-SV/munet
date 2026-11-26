import type { Request, Response } from 'express';
import { getNotificationSummary, markAnnouncementsRead } from '../services/notifications.service';

// x-event-id identifica el evento activo; la membresía debe pertenecer a él.
const readEventId = (req: Request) => req.header('x-event-id')?.trim();
const resolveMembership = (req: Request, eventId: string) =>
  req.auth?.memberships.find((membership) => membership.eventId === eventId) ?? null;

const context = (req: Request, res: Response) => {
  const eventId = readEventId(req);

  if (!eventId) {
    res.status(400).json({ error: 'x-event-id es requerido' });
    return null;
  }

  const membership = resolveMembership(req, eventId);

  if (!membership) {
    res.status(403).json({ error: 'No perteneces a este evento' });
    return null;
  }

  return { eventId, membership };
};

// GET /notifications/summary -> avisos nuevos y mensajes directos sin leer.
export const getSummary = async (req: Request, res: Response) => {
  try {
    const ctx = context(req, res);

    if (!ctx) {
      return;
    }

    const result = await getNotificationSummary(ctx);
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudieron cargar las notificaciones' });
  }
};

// POST /notifications/announcements/read -> marca el muro de avisos como leído.
export const readAnnouncements = async (req: Request, res: Response) => {
  try {
    const ctx = context(req, res);

    if (!ctx) {
      return;
    }

    const result = await markAnnouncementsRead(ctx);
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudo marcar los avisos como leídos' });
  }
};
