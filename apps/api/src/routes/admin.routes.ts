import { Router } from 'express';
import { createAccount, createCommittee, createEvent, createMembership } from '../controllers/admin.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

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
