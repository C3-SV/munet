import { Router } from 'express';
import {
  getMyProfile,
  getPublicProfile,
  updatePublicProfileAsAdmin,
  updateMyProfile,
  uploadPublicAvatarAsAdmin,
  uploadMyAvatar,
} from '../controllers/profiles.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireEventOpenForWrites } from '../middleware/event-status.middleware';

const router = Router();

// Perfil propio y perfiles públicos por membership dentro del evento activo.
router.get('/me', requireAuth, getMyProfile);
router.patch('/me', requireAuth, requireEventOpenForWrites, updateMyProfile);
router.post('/me/avatar', requireAuth, requireEventOpenForWrites, uploadMyAvatar);
router.patch('/:membershipId', requireAuth, updatePublicProfileAsAdmin);
router.post('/:membershipId/avatar', requireAuth, uploadPublicAvatarAsAdmin);
router.get('/:membershipId', requireAuth, getPublicProfile);

export default router;
