import { Router } from 'express';
import { activateAccount, login } from '../controllers/auth.controller';

const router = Router();

router.post('/activate', activateAccount);
router.post('/login', login);

export default router;