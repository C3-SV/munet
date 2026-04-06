import { Router } from 'express';
import { listEventCommittees, listEventWalls } from '../controllers/events.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/:eventId/walls', requireAuth, listEventWalls);
router.get('/:eventId/committees', requireAuth, listEventCommittees);

export default router;
