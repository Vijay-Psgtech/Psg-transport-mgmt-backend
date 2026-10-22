import { Router } from 'express';
import { listUsers, createUser } from '../controllers/userController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES, FLEET_MANAGERS } from '../constants/roles.js';

const router = Router();
router.use(protect);

router.get('/', authorize(...FLEET_MANAGERS), listUsers);
router.post('/', authorize(ROLES.ADMIN), createUser);

export default router;
