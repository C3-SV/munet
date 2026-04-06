import { Router } from 'express';
import { activateAccount, getAuthContext, login } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/activate', activateAccount);
router.post('/login', login);
router.get('/context', requireAuth, getAuthContext);

export default router;
