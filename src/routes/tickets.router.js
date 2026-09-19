import { Router } from 'express';
import * as tickets from '../controllers/tickets.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
const router = Router();
router.use(authenticate);
router.get('/my-tickets', tickets.listMine);
router.patch('/:tid/cancel', tickets.cancel);
export default router;
