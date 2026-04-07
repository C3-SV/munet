import type { Request, Response } from 'express';
import { createPostComment, deletePostComment, listCommentsByPost } from '../services/comments.service';
import {
  closePollService,
  createPostService,
  deletePostService,
  getPostsByWall,
  voteOnPollService,
} from '../services/posts.service';

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
