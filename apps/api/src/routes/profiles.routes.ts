import { Router } from 'express';
import {
  getMyProfile,
  getPublicProfile,
  updateMyProfile,
  uploadMyAvatar,
} from '../controllers/profiles.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/me', requireAuth, getMyProfile);
router.patch('/me', requireAuth, updateMyProfile);
router.post('/me/avatar', requireAuth, uploadMyAvatar);
router.get('/:membershipId', requireAuth, getPublicProfile);

export default router;
