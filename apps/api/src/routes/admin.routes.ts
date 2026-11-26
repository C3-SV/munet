import { Router } from 'express';
import { moderationWriteLimiter } from '../middleware/rate-limit';
import { deleteModerationAttachment } from '../controllers/attachments.controller';
import {
  listModerationWalls, listModerationPeople, listModerationPosts, listModerationComments,
  deleteModerationPost, deleteModerationComment, pinModerationPost, unpinModerationPost,
  hideModerationPost, unhideModerationPost, hideModerationComment, unhideModerationComment,
} from '../controllers/admin-moderation.controller';
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
  changeParticipantRole,
  confirmParticipantImport,
  previewParticipantImport,
} from '../controllers/admin-participants.controller';
import {
  eventIdFromBody,
  eventIdFromCommittee,
  eventIdFromMembership,
  eventIdFromParam,
  eventIdFromQuery,
  eventIdFromWall,
  eventIdFromPost,
  eventIdFromComment,
  requireAdmin,
  requireAuth,
  requireEventAdmin,
  requireEventModerator,
  requireSuperAdmin,
} from '../middleware/auth.middleware';
import { requireEventOpenForWrites } from '../middleware/event-status.middleware';
import { listAuditLogs } from '../controllers/admin-audit.controller';

const router = Router();

// Rutas de administración para catálogos y altas operativas.
// Protegidas con requireAuth (sesión válida) y, salvo la creación de un
// evento nuevo (que no tiene evento objetivo), con requireEventAdmin: exige
// una membership admin activa EN EL EVENTO sobre el que se opera (ver
// ADR-004 / P-01). Crear eventos exige superadmin; listar conserva requireAdmin.

// Eventos
router.get('/events', requireAuth, requireAdmin, listEvents);
router.get('/events/:eventId', requireAuth, requireEventAdmin(eventIdFromParam('eventId')), getEvent);
router.post('/events', requireAuth, requireSuperAdmin, createEvent);
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
router.patch('/participants/:membershipId/role', requireAuth, requireMembershipEventAdmin, changeParticipantRole);

// El evento proviene del recurso para impedir que un parametro suplante su pertenencia.
const requireWallModerator = requireEventModerator(eventIdFromWall, { missingStatus: 404, missingMessage: 'Muro no encontrado' });
const requirePostModerator = requireEventModerator(eventIdFromPost, { missingStatus: 404, missingMessage: 'Post no encontrado' });
const requireCommentModerator = requireEventModerator(eventIdFromComment, { missingStatus: 404, missingMessage: 'Comentario no encontrado' });
router.get('/moderation/walls', requireAuth, requireEventModerator(eventIdFromQuery), listModerationWalls);
router.get('/moderation/people', requireAuth, requireEventModerator(eventIdFromQuery), listModerationPeople);
router.get('/moderation/posts', requireAuth, requireWallModerator, listModerationPosts);
router.get('/moderation/posts/:postId/comments', requireAuth, requirePostModerator, listModerationComments);
router.post('/moderation/posts/:postId/delete', requireAuth, requirePostModerator, requireEventOpenForWrites, moderationWriteLimiter, deleteModerationPost);
router.post('/moderation/posts/:postId/attachment/delete', requireAuth, requirePostModerator, requireEventOpenForWrites, moderationWriteLimiter, deleteModerationAttachment);
router.post('/moderation/comments/:commentId/delete', requireAuth, requireCommentModerator, requireEventOpenForWrites, moderationWriteLimiter, deleteModerationComment);
router.post('/moderation/posts/:postId/pin', requireAuth, requirePostModerator, requireEventOpenForWrites, moderationWriteLimiter, pinModerationPost);
router.post('/moderation/posts/:postId/unpin', requireAuth, requirePostModerator, requireEventOpenForWrites, moderationWriteLimiter, unpinModerationPost);
router.post('/moderation/posts/:postId/hide', requireAuth, requirePostModerator, requireEventOpenForWrites, moderationWriteLimiter, hideModerationPost);
router.post('/moderation/posts/:postId/unhide', requireAuth, requirePostModerator, requireEventOpenForWrites, moderationWriteLimiter, unhideModerationPost);
router.post('/moderation/comments/:commentId/hide', requireAuth, requireCommentModerator, requireEventOpenForWrites, moderationWriteLimiter, hideModerationComment);
router.post('/moderation/comments/:commentId/unhide', requireAuth, requireCommentModerator, requireEventOpenForWrites, moderationWriteLimiter, unhideModerationComment);

// Consulta de auditoria por evento (ADR-007). Solo lectura: sin guarda de cierre.
// ADMIN_TECH ve el registro completo; ADMIN_MUN, solo las acciones de cuidado general.
router.get('/audit-logs', requireAuth, requireEventAdmin(eventIdFromQuery), listAuditLogs);

export default router;
