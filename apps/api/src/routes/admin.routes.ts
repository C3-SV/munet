import { Router } from 'express';
import { createAccount, createCommittee, createEvent, createMembership } from '../controllers/admin.controller';
import { requireAuth, requireEventMembership, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.post(
  '/events',
  requireAuth,
  requireEventMembership,
  requireRole('ADMIN_MUN'),
  createEvent
);

router.post(
  '/committees',
  requireAuth,
  requireEventMembership,
  requireRole('ADMIN_MUN'),
  createCommittee
);

router.post(
  '/memberships',
  requireAuth,
  requireEventMembership,
  requireRole('ADMIN_MUN'),
  createMembership
);

router.post(
  '/create-account',
  requireAuth,
  requireEventMembership,
  requireRole('ADMIN_MUN'),
  createAccount
);

export default router;