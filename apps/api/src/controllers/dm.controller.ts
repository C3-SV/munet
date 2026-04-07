import type { Request, Response } from 'express';
import {
  createDmMessage,
  createOrReuseDmConversation,
  deleteDmMessage,
  listDmConversations,
  listDmMessages,
  searchDmParticipants,
} from '../services/dm.service';

// Lee event_id activo desde header para todos los endpoints de DM.
const readEventId = (req: Request) => req.header('x-event-id')?.trim();

// Obtiene membership del usuario para el evento activo.
const resolveMembership = (req: Request, eventId: string) =>
  req.auth?.memberships.find((membership) => membership.eventId === eventId) ?? null;

// GET /dm/conversations -> lista conversaciones visibles del usuario.
export const listConversations = async (req: Request, res: Response) => {
  try {
    const eventId = readEventId(req);

    if (!eventId) {
      return res.status(400).json({ error: 'x-event-id es requerido' });
    }

    const membership = resolveMembership(req, eventId);

    if (!membership) {
      return res.status(403).json({ error: 'No perteneces a este evento' });
    }

    const result = await listDmConversations({ eventId, membership });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// GET /dm/participants -> búsqueda de posibles destinatarios por evento.
export const listParticipants = async (req: Request, res: Response) => {
  try {
    const eventId = readEventId(req);

    if (!eventId) {
      return res.status(400).json({ error: 'x-event-id es requerido' });
    }

    const membership = resolveMembership(req, eventId);

    if (!membership) {
      return res.status(403).json({ error: 'No perteneces a este evento' });
    }

    const result = await searchDmParticipants({
      eventId,
      membership,
      query: String(req.query.search ?? ''),
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// POST /dm/conversations -> reusa conversación existente o crea una nueva.
export const createConversation = async (req: Request, res: Response) => {
  try {
    const eventId = readEventId(req);

    if (!eventId) {
      return res.status(400).json({ error: 'x-event-id es requerido' });
    }

    const membership = resolveMembership(req, eventId);

    if (!membership) {
      return res.status(403).json({ error: 'No perteneces a este evento' });
    }

    const result = await createOrReuseDmConversation({
      eventId,
      membership,
      targetMembershipId: String(req.body?.targetMembershipId ?? ''),
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// GET /dm/conversations/:id/messages -> mensajes de la conversación.
export const listMessages = async (req: Request, res: Response) => {
  try {
    const eventId = readEventId(req);

    if (!eventId) {
      return res.status(400).json({ error: 'x-event-id es requerido' });
    }

    const membership = resolveMembership(req, eventId);

    if (!membership) {
      return res.status(403).json({ error: 'No perteneces a este evento' });
    }

    const result = await listDmMessages({
      eventId,
      membership,
      conversationId: String(req.params.conversationId),
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// POST /dm/conversations/:id/messages -> envía mensaje al chat.
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const eventId = readEventId(req);

    if (!eventId) {
      return res.status(400).json({ error: 'x-event-id es requerido' });
    }

    const membership = resolveMembership(req, eventId);

    if (!membership) {
      return res.status(403).json({ error: 'No perteneces a este evento' });
    }

    const result = await createDmMessage({
      eventId,
      membership,
      conversationId: String(req.params.conversationId),
      content: req.body?.content,
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// DELETE /dm/conversations/:id/messages/:messageId -> soft delete del mensaje propio.
export const deleteMessage = async (req: Request, res: Response) => {
  try {
    const eventId = readEventId(req);

    if (!eventId) {
      return res.status(400).json({ error: 'x-event-id es requerido' });
    }

    const membership = resolveMembership(req, eventId);

    if (!membership) {
      return res.status(403).json({ error: 'No perteneces a este evento' });
    }

    const result = await deleteDmMessage({
      eventId,
      membership,
      conversationId: String(req.params.conversationId),
      messageId: String(req.params.messageId),
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};
