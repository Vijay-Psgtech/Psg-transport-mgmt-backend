import { Router } from 'express';
import {
  lookupUsers, listUsers, getUserStats, getUser, createUser, updateUser,
  setUserStatus, resetUserPassword, deleteUser,
} from '../controllers/userController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES, FLEET_MANAGERS } from '../constants/roles.js';

const router = Router();
router.use(protect);

// Admin: all roles. Transport officer: drivers only (enforced inside the controller).
const staff = authorize(...FLEET_MANAGERS);

router.get('/lookup', staff, lookupUsers); // keep static routes above '/:id'
router.get('/stats', staff, getUserStats);
router.route('/').get(staff, listUsers).post(staff, createUser);
router.route('/:id').get(staff, getUser).put(staff, updateUser).delete(authorize(ROLES.ADMIN), deleteUser);
router.patch('/:id/status', staff, setUserStatus);
router.post('/:id/reset-password', staff, resetUserPassword);

export default router;
