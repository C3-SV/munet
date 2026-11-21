import { Router } from 'express';
import { deleteOwnAttachment, downloadAttachment, initUpload } from '../controllers/attachments.controller';
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
import { attachmentInitLimiter, createPostLimiter, createCommentLimiter } from '../middleware/rate-limit';

const router = Router();

// Feed y publicaciones (texto/encuestas) con comentarios asociados.
// Todas las rutas requieren sesión válida.
router.get('/', requireAuth, listPosts);
router.post('/', requireAuth, createPostLimiter, createPost);
router.post('/attachments/init', requireAuth, attachmentInitLimiter, initUpload);
router.get('/:postId/attachment/download', requireAuth, downloadAttachment);
router.delete('/:postId/attachment', requireAuth, deleteOwnAttachment);
router.delete('/:postId', requireAuth, deletePost);
router.post('/:postId/poll/vote', requireAuth, voteOnPoll);
router.post('/:postId/poll/close', requireAuth, closePoll);
router.get('/:postId/comments', requireAuth, listComments);
router.post('/:postId/comments', requireAuth, createCommentLimiter, createComment);
router.delete('/:postId/comments/:commentId', requireAuth, deleteComment);

export default router;
