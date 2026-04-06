import { Router } from 'express';
import { createAccount, createCommittee, createEvent, createMembership } from '../controllers/admin.controller';

const router = Router();

router.post('/events', createEvent);
router.post('/create-account', createAccount);
router.post('/memberships', createMembership);
router.post('/committees', createCommittee);

export default router;