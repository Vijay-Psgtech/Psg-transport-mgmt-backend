import { Router } from 'express';
import {
  getAssignmentAvailability, listVehicleAssignments, listDriverTrips, submitTripSheet,
  listTripSheets, createVehicleAssignment, assignVehicleRequest, updateVehicleAssignmentStatus,
  submitVehicleFeedback,
} from '../controllers/vehicleAssignmentController.js';
import { protect, authorize } from '../middleware/auth.js';
import { FLEET_MANAGERS, ROLES } from '../constants/roles.js';

const router = Router();
router.use(protect);

router.get('/availability', authorize(...FLEET_MANAGERS), getAssignmentAvailability);
router.get('/my-trips', authorize(ROLES.DRIVER), listDriverTrips);
router.get('/', listVehicleAssignments);
router.post('/', createVehicleAssignment);
router.get('/:id/trip-sheets', listTripSheets);
router.post('/:id/trip-sheets', authorize(ROLES.DRIVER), submitTripSheet);
router.post('/:id/feedback', authorize(ROLES.TRANSPORT_USER), submitVehicleFeedback);
router.patch('/:id/assign', authorize(...FLEET_MANAGERS), assignVehicleRequest);
router.patch('/:id/status', updateVehicleAssignmentStatus);

export default router;
