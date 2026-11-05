import { Router } from 'express';
import {
  getAssignmentAvailability, listVehicleAssignments, listDriverTrips, submitTripSheet,
  createVehicleAssignment, assignVehicleRequest, updateVehicleAssignmentStatus,
} from '../controllers/vehicleAssignmentController.js';
import { protect, authorize } from '../middleware/auth.js';
import { FLEET_MANAGERS, ROLES } from '../constants/roles.js';

const router = Router();
router.use(protect);

router.get('/availability', authorize(...FLEET_MANAGERS), getAssignmentAvailability);
router.get('/my-trips', authorize(ROLES.DRIVER), listDriverTrips);
router.get('/', listVehicleAssignments);
router.post('/', createVehicleAssignment);
router.patch('/:id/trip-sheet', authorize(ROLES.DRIVER), submitTripSheet);
router.patch('/:id/assign', authorize(...FLEET_MANAGERS), assignVehicleRequest);
router.patch('/:id/status', updateVehicleAssignmentStatus);

export default router;
