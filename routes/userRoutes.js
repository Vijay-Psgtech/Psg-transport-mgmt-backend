import { Router } from 'express';
import {
  lookupUsers, listUsers, getUserStats, getUser, getDriverLicenseImage, createUser, updateUser,
  setUserStatus, resetUserPassword, deleteUser,
} from '../controllers/userController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES, FLEET_MANAGERS } from '../constants/roles.js';
import uploadDriverLicense from '../middleware/driverLicenseUpload.js';

const router = Router();
router.use(protect);

// Admin: all roles. Transport officer: drivers only (enforced inside the controller).
const staff = authorize(...FLEET_MANAGERS);

router.get('/lookup', staff, lookupUsers); // keep static routes above '/:id'
router.get('/stats', staff, getUserStats);
router.get('/:id/license-image/:filename', staff, getDriverLicenseImage);
router.route('/')
  .get(staff, listUsers)
  .post(staff, uploadDriverLicense, createUser);
router.route('/:id')
  .get(staff, getUser)
  .put(staff, uploadDriverLicense, updateUser)
  .delete(authorize(ROLES.ADMIN), deleteUser);
router.patch('/:id/status', staff, setUserStatus);
router.post('/:id/reset-password', staff, resetUserPassword);

export default router;
