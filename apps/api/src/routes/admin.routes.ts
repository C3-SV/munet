import { Router } from 'express';
import {
  createAccount,
  createCommittee,
  createEvent,
  createMembership,
  deleteCommittee,
  getCommittee,
  getEvent,
  listCommittees,
  listEvents,
  updateCommittee,
  updateEvent,
} from '../controllers/admin.controller';
import { requireAdmin, requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Rutas de administración para catálogos y altas operativas.
// Protegidas con requireAuth (sesión válida) + requireAdmin (al menos una
// membership activa con rol admin en cualquier evento).

// Eventos
router.get('/events', requireAuth, requireAdmin, listEvents);
router.get('/events/:eventId', requireAuth, requireAdmin, getEvent);
router.post('/events', requireAuth, requireAdmin, createEvent);
router.patch('/events/:eventId', requireAuth, requireAdmin, updateEvent);

// Comités
router.get('/committees', requireAuth, requireAdmin, listCommittees);
router.get('/committees/:committeeId', requireAuth, requireAdmin, getCommittee);
router.post('/committees', requireAuth, requireAdmin, createCommittee);
router.patch('/committees/:committeeId', requireAuth, requireAdmin, updateCommittee);
router.delete('/committees/:committeeId', requireAuth, requireAdmin, deleteCommittee);

// Memberships y cuentas
router.post('/memberships', requireAuth, requireAdmin, createMembership);
router.post('/create-account', requireAuth, requireAdmin, createAccount);

export default router;
