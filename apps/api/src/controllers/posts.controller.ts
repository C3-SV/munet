import type { Request, Response } from 'express';
import { createPostService, getPostsByWall } from '../services/posts.service';

/**
 * Controller para listar publicaciones.
 * Aquí solo debería existir lógica HTTP:
 * - leer req
 * - llamar servicio
 * - devolver res
 */
export const listPosts = async (req: Request, res: Response) => {
  try {
    const muro = String(req.query.muro ?? 'general');
    const eventId = req.query.eventId ? String(req.query.eventId) : undefined;

    const result = await getPostsByWall({ muro, eventId });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

/**
 * Controller para crear publicaciones.
 * Igual que arriba: solo coordina request/response.
 */
export const createPost = async (req: Request, res: Response) => {
  try {
    const { muro, content, authorMembershipId } = req.body as {
      muro?: string;
      content?: string;
      authorMembershipId?: string;
    };

    const result = await createPostService({
      muro,
      content,
      authorMembershipId,
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};