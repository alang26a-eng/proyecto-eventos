import { Router } from 'express';
import { getSessionsStatus, register } from '../controllers/sessions.controller.js';

const router = Router();
router.get('/', getSessionsStatus);
router.post('/register', register);
export default router;

