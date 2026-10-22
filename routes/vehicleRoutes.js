import { Router } from 'express';
import {
  getVehicles, getVehicleStats, getVehicle, createVehicle, updateVehicle, deleteVehicle,
} from '../controllers/vehicleController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES, FLEET_MANAGERS } from '../constants/roles.js';

const router = Router();
router.use(protect);

const manage = authorize(...FLEET_MANAGERS);

router.get('/stats', manage, getVehicleStats); // keep above '/:id'
router.route('/').get(manage, getVehicles).post(manage, createVehicle);
router.route('/:id')
  .get(manage, getVehicle)
  .put(manage, updateVehicle)
  .delete(authorize(ROLES.ADMIN), deleteVehicle);

export default router;
