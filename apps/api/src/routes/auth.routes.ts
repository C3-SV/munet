import { Router } from 'express';
import { activateAccount } from '../controllers/auth.controller';

const router = Router();

router.post('/activate', activateAccount);

export default router;