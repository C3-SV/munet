import { Router } from 'express';
import { createAccount, createCommittee, createEvent, createMembership } from '../controllers/admin.controller';
import { requireAuth, requireEventMembership, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.post(
  '/events',
  createEvent
);

router.post(
  '/committees',
  createCommittee
);

router.post(
  '/memberships',
  createMembership
);

router.post(
  '/create-account',
  createAccount
);

export default router;