import type { Request, Response } from 'express';
import { createPostComment, deletePostComment, listCommentsByPost } from '../services/comments.service';
import {
  closePollService,
  createPostService,
  deletePostService,
  getPostsByWall,
  voteOnPollService,
} from '../services/posts.service';

// Obtiene la membership del usuario para el evento activo.
const resolveMembership = (req: Request, eventId: string) =>
  req.auth?.memberships.find((membership) => membership.eventId === eventId) ?? null;

// Normaliza lectura de x-event-id desde headers.
const readEventId = (req: Request) => req.header('x-event-id')?.trim();

// GET /posts -> devuelve posts del muro solicitado con validación RBAC.
export const listPosts = async (req: Request, res: Response) => {
  try {
    const muro = String(req.query.muro ?? 'general');
    const eventId = readEventId(req);

    if (!eventId) {
      return res.status(400).json({ error: 'x-event-id es requerido' });
    }

    const membership = resolveMembership(req, eventId);

    if (!membership) {
      return res.status(403).json({ error: 'No perteneces a este evento' });
    }

    const result = await getPostsByWall({ muro, eventId, membership });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// POST /posts -> crea publicación de texto o encuesta.
export const createPost = async (req: Request, res: Response) => {
  try {
    const eventId = readEventId(req);

    if (!eventId) {
      return res.status(400).json({ error: 'x-event-id es requerido' });
    }

    const membership = resolveMembership(req, eventId);

    if (!membership) {
      return res.status(403).json({ error: 'No perteneces a este evento' });
    }

    const { muro, content, post_type, poll_options } = req.body as {
      muro?: string;
      content?: string;
      post_type?: string;
      poll_options?: string[];
    };

    const result = await createPostService({
      muro,
      content,
      postType: post_type,
      pollOptions: poll_options,
      eventId,
      membership,
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// DELETE /posts/:postId -> soft delete del post (autor o admin).
export const deletePost = async (req: Request, res: Response) => {
  try {
    const eventId = readEventId(req);

    if (!eventId) {
      return res.status(400).json({ error: 'x-event-id es requerido' });
    }

    const membership = resolveMembership(req, eventId);

    if (!membership) {
      return res.status(403).json({ error: 'No perteneces a este evento' });
    }

    const result = await deletePostService({
      postId: String(req.params.postId),
      eventId,
      membership,
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// GET /posts/:postId/comments -> listado plano de comentarios del post.
export const listComments = async (req: Request, res: Response) => {
  try {
    const eventId = readEventId(req);

    if (!eventId) {
      return res.status(400).json({ error: 'x-event-id es requerido' });
    }

    const membership = resolveMembership(req, eventId);

    if (!membership) {
      return res.status(403).json({ error: 'No perteneces a este evento' });
    }

    const result = await listCommentsByPost({
      postId: String(req.params.postId),
      eventId,
      membership,
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// POST /posts/:postId/comments -> crea comentario/respuesta (profundidad 1).
export const createComment = async (req: Request, res: Response) => {
  try {
    const eventId = readEventId(req);

    if (!eventId) {
      return res.status(400).json({ error: 'x-event-id es requerido' });
    }

    const membership = resolveMembership(req, eventId);

    if (!membership) {
      return res.status(403).json({ error: 'No perteneces a este evento' });
    }

    const { content, parent_comment_id } = req.body as {
      content?: string;
      parent_comment_id?: string;
    };

    const result = await createPostComment({
      postId: String(req.params.postId),
      eventId,
      membership,
      content,
      parentCommentId: parent_comment_id,
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// DELETE /posts/:postId/comments/:commentId -> soft delete de comentario.
export const deleteComment = async (req: Request, res: Response) => {
  try {
    const eventId = readEventId(req);

    if (!eventId) {
      return res.status(400).json({ error: 'x-event-id es requerido' });
    }

    const membership = resolveMembership(req, eventId);

    if (!membership) {
      return res.status(403).json({ error: 'No perteneces a este evento' });
    }

    const result = await deletePostComment({
      postId: String(req.params.postId),
      commentId: String(req.params.commentId),
      eventId,
      membership,
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// POST /posts/:postId/poll/vote -> registra o reemplaza el voto del usuario.
export const voteOnPoll = async (req: Request, res: Response) => {
  try {
    const eventId = readEventId(req);

    if (!eventId) {
      return res.status(400).json({ error: 'x-event-id es requerido' });
    }

    const membership = resolveMembership(req, eventId);

    if (!membership) {
      return res.status(403).json({ error: 'No perteneces a este evento' });
    }

    const { option_id } = req.body as {
      option_id?: string;
    };

    const result = await voteOnPollService({
      postId: String(req.params.postId),
      eventId,
      membership,
      optionId: option_id,
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// POST /posts/:postId/poll/close -> cierre de encuesta por su creador.
export const closePoll = async (req: Request, res: Response) => {
  try {
    const eventId = readEventId(req);

    if (!eventId) {
      return res.status(400).json({ error: 'x-event-id es requerido' });
    }

    const membership = resolveMembership(req, eventId);

    if (!membership) {
      return res.status(403).json({ error: 'No perteneces a este evento' });
    }

    const result = await closePollService({
      postId: String(req.params.postId),
      eventId,
      membership,
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};
