import { Router } from 'express';
import { getMyProfile, getPublicProfile, updateMyProfile } from '../controllers/profiles.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/me', requireAuth, getMyProfile);
router.patch('/me', requireAuth, updateMyProfile);
router.get('/:membershipId', requireAuth, getPublicProfile);

export default router;
