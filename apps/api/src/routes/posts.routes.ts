import { Router } from 'express';
import {
  createComment,
  createPost,
  deleteComment,
  deletePost,
  listComments,
  listPosts,
} from '../controllers/posts.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/', requireAuth, listPosts);
router.post('/', requireAuth, createPost);
router.delete('/:postId', requireAuth, deletePost);
router.get('/:postId/comments', requireAuth, listComments);
router.post('/:postId/comments', requireAuth, createComment);
router.delete('/:postId/comments/:commentId', requireAuth, deleteComment);

export default router;
