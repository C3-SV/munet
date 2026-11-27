import type { Request, Response } from 'express';
import {
  getAttachmentDownload,
  getAttachmentDownloads,
  initAttachmentUpload,
  removeAttachment,
} from '../services/attachments.service';

const readEventId = (req: Request) => req.header('x-event-id')?.trim();

const resolveMembership = (req: Request, eventId: string) =>
  req.auth?.memberships.find((membership) => membership.eventId === eventId) ?? null;

// Las respuestas llevan URL firmadas: no deben guardarse en cachés.
const noStore = (res: Response) => res.setHeader('Cache-Control', 'no-store');

// POST /posts/attachments/init -> autoriza una subida y devuelve la URL firmada.
export const initUpload = async (req: Request, res: Response) => {
  try {
    const eventId = readEventId(req);

    if (!eventId) {
      return res.status(400).json({ error: 'x-event-id es requerido' });
    }

    const membership = resolveMembership(req, eventId);

    if (!membership) {
      return res.status(403).json({ error: 'No perteneces a este evento' });
    }

    const { muro, file_name, mime_type, size } = (req.body ?? {}) as {
      muro?: string;
      file_name?: unknown;
      mime_type?: unknown;
      size?: unknown;
    };

    const result = await initAttachmentUpload({
      eventId,
      membership,
      muro,
      fileName: file_name,
      mimeType: mime_type,
      size,
    });

    noStore(res);
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// GET /posts/:postId/attachments/:attachmentId/download (o la ruta anterior /attachment/download,
// que entrega el primero) -> URL firmada de 60 segundos, a demanda.
export const downloadAttachment = async (req: Request, res: Response) => {
  try {
    const eventId = readEventId(req);

    if (!eventId) {
      return res.status(400).json({ error: 'x-event-id es requerido' });
    }

    const membership = resolveMembership(req, eventId);

    if (!membership) {
      return res.status(403).json({ error: 'No perteneces a este evento' });
    }

    const result = await getAttachmentDownload({
      postId: String(req.params.postId),
      eventId,
      membership,
      // Sin id (ruta anterior) se entrega el primer adjunto.
      attachmentId: req.params.attachmentId ? String(req.params.attachmentId) : null,
    });

    noStore(res);
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// POST /posts/attachments/downloads -> firma hasta 40 previews; los errores de cada archivo son parciales.
export const downloadAttachments = async (req: Request, res: Response) => {
  try {
    const eventId = readEventId(req);

    if (!eventId) {
      return res.status(400).json({ error: 'x-event-id es requerido' });
    }

    const membership = resolveMembership(req, eventId);

    if (!membership) {
      return res.status(403).json({ error: 'No perteneces a este evento' });
    }

    const items = (req.body as { items?: unknown } | undefined)?.items;
    if (!Array.isArray(items) || items.length < 1 || items.length > 40) {
      return res.status(400).json({ error: 'items debe incluir entre 1 y 40 adjuntos' });
    }

    const result = await getAttachmentDownloads({ eventId, membership, items });
    noStore(res);
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// DELETE /posts/:postId/attachments/:attachmentId (o /attachment, si hay uno solo) -> el autor retira su adjunto.
export const deleteOwnAttachment = async (req: Request, res: Response) => {
  try {
    const eventId = readEventId(req);

    if (!eventId) {
      return res.status(400).json({ error: 'x-event-id es requerido' });
    }

    const membership = resolveMembership(req, eventId);

    if (!membership) {
      return res.status(403).json({ error: 'No perteneces a este evento' });
    }

    const result = await removeAttachment({
      postId: String(req.params.postId),
      eventId,
      membership,
      mode: 'AUTHOR',
      attachmentId: req.params.attachmentId ? String(req.params.attachmentId) : null,
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// POST /admin/moderation/posts/:postId/attachment/delete -> moderación retira el adjunto con motivo.
// La ruta ya exige administrador o moderador activo del evento del post.
export const deleteModerationAttachment = async (req: Request, res: Response) => {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

  if (reason.length < 3 || reason.length > 500) {
    return res.status(400).json({ error: 'reason debe tener entre 3 y 500 caracteres' });
  }

  try {
    const membership = req.auth!.currentMembership!;

    const result = await removeAttachment({
      postId: String(req.params.postId),
      eventId: membership.eventId,
      membership,
      mode: 'MODERATION',
      reason,
      // Obligatorio si la publicación tiene varios adjuntos.
      attachmentId: typeof req.body?.attachment_id === 'string' ? req.body.attachment_id.trim() : null,
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudo retirar el adjunto' });
  }
};
