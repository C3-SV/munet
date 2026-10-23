import { Router } from 'express';
import { createAccount, createCommittee, createEvent, createMembership } from '../controllers/admin.controller';
import { requireAdmin, requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Rutas de administración para catálogos y altas operativas.
// Protegidas con requireAuth (sesión válida) + requireAdmin (al menos una
// membership activa con rol admin en cualquier evento).
router.post(
  '/events',
  requireAuth,
  requireAdmin,
  createEvent
);

router.post(
  '/committees',
  requireAuth,
  requireAdmin,
  createCommittee
);

router.post(
  '/memberships',
  requireAuth,
  requireAdmin,
  createMembership
);

router.post(
  '/create-account',
  requireAuth,
  requireAdmin,
  createAccount
);

export default router;
