import { Router } from 'express';
import {
  createConversation,
  deleteMessage,
  listConversations,
  listMessages,
  listParticipants,
  sendMessage,
} from '../controllers/dm.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireEventOpenForWrites } from '../middleware/event-status.middleware';
import { sendDmLimiter } from '../middleware/rate-limit';

const router = Router();

// Módulo de mensajería directa (conversaciones, participantes y mensajes).
router.get('/conversations', requireAuth, listConversations);
router.post('/conversations', requireAuth, requireEventOpenForWrites, createConversation);
router.get('/participants', requireAuth, listParticipants);
router.get('/conversations/:conversationId/messages', requireAuth, listMessages);
router.post('/conversations/:conversationId/messages', requireAuth, requireEventOpenForWrites, sendDmLimiter, sendMessage);
router.delete('/conversations/:conversationId/messages/:messageId', requireAuth, requireEventOpenForWrites, deleteMessage);

export default router;
