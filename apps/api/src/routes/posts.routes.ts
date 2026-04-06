import { Router } from 'express';
import { createComment, createPost, listComments, listPosts } from '../controllers/posts.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/', requireAuth, listPosts);
router.post('/', requireAuth, createPost);
router.get('/:postId/comments', requireAuth, listComments);
router.post('/:postId/comments', requireAuth, createComment);

export default router;
