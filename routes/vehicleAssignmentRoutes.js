import { Router } from 'express';
import {
  getAssignmentAvailability, listVehicleAssignments, createVehicleAssignment,
  assignVehicleRequest, updateVehicleAssignmentStatus,
} from '../controllers/vehicleAssignmentController.js';
import { protect, authorize } from '../middleware/auth.js';
import { FLEET_MANAGERS } from '../constants/roles.js';

const router = Router();
router.use(protect);

router.get('/availability', authorize(...FLEET_MANAGERS), getAssignmentAvailability);
router.get('/', listVehicleAssignments);
router.post('/', createVehicleAssignment);
router.patch('/:id/assign', authorize(...FLEET_MANAGERS), assignVehicleRequest);
router.patch('/:id/status', updateVehicleAssignmentStatus);

export default router;
