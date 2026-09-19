import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/authorize.middleware.js';
import { listUsers } from '../controllers/users.controller.js';
const router = Router();
router.get('/', authenticate, authorize('admin'), listUsers);
export default router;
