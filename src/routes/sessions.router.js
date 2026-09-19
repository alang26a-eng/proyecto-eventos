import { Router } from 'express';
import { getSessionsStatus, register } from '../controllers/sessions.controller.js';
import { loginUser } from '../controllers/auth.controller.js';
const router = Router();
router.get('/', getSessionsStatus);
router.post('/register', register);
router.post('/login', loginUser);
export default router;
