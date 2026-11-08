import { Router } from 'express';
import {
  createAccount,
  createCommittee,
  createEvent,
  createMembership,
  deleteCommittee,
  getCommittee,
  getEvent,
  getParticipant,
  listCommittees,
  listEvents,
  listParticipants,
  reactivateParticipant,
  resetParticipantPassword,
  suspendParticipant,
  updateCommittee,
  updateEvent,
  updateParticipant,
} from '../controllers/admin.controller';
import {
  changeParticipantCommittee,
  confirmParticipantImport,
  previewParticipantImport,
} from '../controllers/admin-participants.controller';
import {
  eventIdFromBody,
  eventIdFromCommittee,
  eventIdFromMembership,
  eventIdFromParam,
  eventIdFromQuery,
  requireAdmin,
  requireAuth,
  requireEventAdmin,
} from '../middleware/auth.middleware';

const router = Router();

// Rutas de administración para catálogos y altas operativas.
// Protegidas con requireAuth (sesión válida) y, salvo la creación de un
// evento nuevo (que no tiene evento objetivo), con requireEventAdmin: exige
// una membership admin activa EN EL EVENTO sobre el que se opera (ver
// ADR-004 / P-01). requireAdmin (cualquier evento) solo se usa donde todavía
// no existe un evento al que acotar la autorización.

// Eventos
router.get('/events', requireAuth, requireAdmin, listEvents);
router.get('/events/:eventId', requireAuth, requireEventAdmin(eventIdFromParam('eventId')), getEvent);
router.post('/events', requireAuth, requireAdmin, createEvent);
router.patch('/events/:eventId', requireAuth, requireEventAdmin(eventIdFromParam('eventId')), updateEvent);

// Comités
router.get('/committees', requireAuth, requireEventAdmin(eventIdFromQuery), listCommittees);
router.get(
  '/committees/:committeeId',
  requireAuth,
  requireEventAdmin(eventIdFromCommittee, { missingStatus: 404, missingMessage: 'Comité no encontrado' }),
  getCommittee
);
router.post('/committees', requireAuth, requireEventAdmin(eventIdFromBody), createCommittee);
router.patch(
  '/committees/:committeeId',
  requireAuth,
  requireEventAdmin(eventIdFromCommittee, { missingStatus: 404, missingMessage: 'Comité no encontrado' }),
  updateCommittee
);
router.delete(
  '/committees/:committeeId',
  requireAuth,
  requireEventAdmin(eventIdFromCommittee, { missingStatus: 404, missingMessage: 'Comité no encontrado' }),
  deleteCommittee
);

// Memberships y cuentas
router.post('/memberships', requireAuth, requireEventAdmin(eventIdFromBody), createMembership);
router.post('/create-account', requireAuth, requireEventAdmin(eventIdFromBody), createAccount);

// Participantes
const requireMembershipEventAdmin = requireEventAdmin(eventIdFromMembership, {
  missingStatus: 404,
  missingMessage: 'Participante no encontrado',
});

// Importacion CSV en dos pasos (S2-05, S2-07). Van antes de las rutas con
// :membershipId para que 'import' nunca se lea como un id.
router.post('/participants/import/preview', requireAuth, requireEventAdmin(eventIdFromBody), previewParticipantImport);
router.post('/participants/import/confirm', requireAuth, requireEventAdmin(eventIdFromBody), confirmParticipantImport);

router.get('/participants', requireAuth, requireEventAdmin(eventIdFromQuery), listParticipants);
router.get('/participants/:membershipId', requireAuth, requireMembershipEventAdmin, getParticipant);
router.patch('/participants/:membershipId', requireAuth, requireMembershipEventAdmin, updateParticipant);
router.post('/participants/:membershipId/suspend', requireAuth, requireMembershipEventAdmin, suspendParticipant);
router.post('/participants/:membershipId/reactivate', requireAuth, requireMembershipEventAdmin, reactivateParticipant);
router.post('/participants/:membershipId/reset-password', requireAuth, requireMembershipEventAdmin, resetParticipantPassword);
router.patch('/participants/:membershipId/committee', requireAuth, requireMembershipEventAdmin, changeParticipantCommittee);

export default router;
