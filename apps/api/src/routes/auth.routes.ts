import { Router } from 'express';
import { activateAccount, getAuthContext, login } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { getEventsByParticipantCode } from '../controllers/admin.controller';

const router = Router();

router.get('/events-by-code/:participant_code', getEventsByParticipantCode);
router.post('/activate', activateAccount);
router.post('/login', login);
router.get('/context', requireAuth, getAuthContext);

export default router;
