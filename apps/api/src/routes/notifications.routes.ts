import { Router } from 'express';
import { getSummary, readAnnouncements } from '../controllers/notifications.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireEventOpenForWrites } from '../middleware/event-status.middleware';
import { readStateLimiter } from '../middleware/rate-limit';

const router = Router();

// Pendientes de lectura (avisos y mensajes directos) de la membresía activa.
router.get('/summary', requireAuth, readStateLimiter, getSummary);
router.post('/announcements/read', requireAuth, requireEventOpenForWrites, readStateLimiter, readAnnouncements);

export default router;
