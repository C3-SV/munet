import { Router } from 'express';
import {
  createMyProfile,
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
router.post('/me', requireAuth, requireEventOpenForWrites, createMyProfile);
router.patch('/me', requireAuth, requireEventOpenForWrites, updateMyProfile);
router.post('/me/avatar', requireAuth, requireEventOpenForWrites, uploadMyAvatar);
router.patch('/:membershipId', requireAuth, requireEventOpenForWrites, updatePublicProfileAsAdmin);
router.post('/:membershipId/avatar', requireAuth, requireEventOpenForWrites, uploadPublicAvatarAsAdmin);
router.get('/:membershipId', requireAuth, getPublicProfile);

export default router;
