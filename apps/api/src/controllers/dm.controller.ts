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
// x-event-id hace que el mismo usuario pueda aislar contexto si participa en varios eventos.

// Obtiene membership del usuario para el evento activo.
const resolveMembership = (req: Request, eventId: string) =>
  req.auth?.memberships.find((membership) => membership.eventId === eventId) ?? null;
// La membership resuelta es la identidad efectiva para permisos y auditoria en DM.

// GET /dm/conversations -> lista conversaciones visibles del usuario.
export const listConversations = async (req: Request, res: Response) => {
  try {
    const eventId = readEventId(req);

    if (!eventId) {
      // Toda operación DM requiere evento activo explícito para evitar cruce entre eventos.
      return res.status(400).json({ error: 'x-event-id es requerido' });
    }

    const membership = resolveMembership(req, eventId);

    if (!membership) {
      // Token válido pero sin membership en el evento seleccionado.
      return res.status(403).json({ error: 'No perteneces a este evento' });
    }

    const result = await listDmConversations({ eventId, membership });
    // Service devuelve shape listo para UI (participant, preview, last message).
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
      // search llega por querystring; se normaliza en service.
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
      // targetMembershipId siempre se trata como string para validarlo en service.
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
      // conversationId via URL param para mantener rutas REST consistentes.
      conversationId: String(req.params.conversationId),
    });
    // conversationId siempre se toma de ruta para mantener enlace estable del chat room.

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
      // Content se valida/trimea en el service antes de insertar.
      content: req.body?.content,
    });
    // No limpiamos aqui: trim/validacion centralizada en service para consistencia.

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
      // Borrado lógico de mensaje puntual dentro de la conversación.
      messageId: String(req.params.messageId),
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};
