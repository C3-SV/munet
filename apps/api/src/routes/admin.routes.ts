import { Router } from 'express';
import { createAccount, createCommittee, createEvent, createMembership } from '../controllers/admin.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Rutas de administración para catálogos y altas operativas.
// Actualmente exigen autenticación; autorización fina se valida en controllers/servicios.
router.post(
  '/events',
  requireAuth,
  createEvent
);

router.post(
  '/committees',
  requireAuth,
  createCommittee
);

router.post(
  '/memberships',
  requireAuth,
  createMembership
);

router.post(
  '/create-account',
  requireAuth,
  createAccount
);

export default router;
