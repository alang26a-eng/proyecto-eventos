import { Router } from 'express';
import { getSessionsStatus } from '../controllers/sessions.controller.js';

const router = Router();
router.get('/', getSessionsStatus);

export default router;
