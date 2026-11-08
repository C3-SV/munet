import { Router } from 'express';
import { listEventCommittees, listEventDirectory, listEventWalls } from '../controllers/events.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Metadata de evento para construir sidebar y navegación de muros/comités.
router.get('/:eventId/walls', requireAuth, listEventWalls);
router.get('/:eventId/committees', requireAuth, listEventCommittees);
router.get('/:eventId/directory', requireAuth, listEventDirectory);

export default router;
