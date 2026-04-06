import type { Request, Response } from 'express';
import { createPostComment, listCommentsByPost } from '../services/comments.service';
import { createPostService, getPostsByWall } from '../services/posts.service';

const resolveMembership = (req: Request, eventId: string) =>
  req.auth?.memberships.find((membership) => membership.eventId === eventId) ?? null;

const readEventId = (req: Request) => req.header('x-event-id')?.trim();

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

    const { muro, content } = req.body as {
      muro?: string;
      content?: string;
    };

    const result = await createPostService({
      muro,
      content,
      eventId,
      membership,
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

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
