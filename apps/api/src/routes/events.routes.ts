import { Router } from 'express';
import { listEventCommittees, listEventParticipants, listEventWalls } from '../controllers/events.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Metadata de evento para construir sidebar y navegación de muros/comités.
router.get('/:eventId/walls', requireAuth, listEventWalls);
router.get('/:eventId/committees', requireAuth, listEventCommittees);
// Directorio paginado de participantes activos del evento (W02).
router.get('/:eventId/participants', requireAuth, listEventParticipants);

export default router;
