import { Router } from 'express';
import {
  closePoll,
  createComment,
  createPost,
  deleteComment,
  deletePost,
  listComments,
  listPosts,
  voteOnPoll,
} from '../controllers/posts.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Feed y publicaciones (texto/encuestas) con comentarios asociados.
// Todas las rutas requieren sesión válida.
router.get('/', requireAuth, listPosts);
router.post('/', requireAuth, createPost);
router.delete('/:postId', requireAuth, deletePost);
router.post('/:postId/poll/vote', requireAuth, voteOnPoll);
router.post('/:postId/poll/close', requireAuth, closePoll);
router.get('/:postId/comments', requireAuth, listComments);
router.post('/:postId/comments', requireAuth, createComment);
router.delete('/:postId/comments/:commentId', requireAuth, deleteComment);

export default router;
