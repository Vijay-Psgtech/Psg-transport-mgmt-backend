import { Router } from 'express';
import {
  getVehicles, getVehicleStats, getVehicle, getVehicleDocumentProof, createVehicle, updateVehicle, deleteVehicle,
} from '../controllers/vehicleController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES, FLEET_MANAGERS } from '../constants/roles.js';
import uploadVehicleProofs from '../middleware/vehicleProofUpload.js';

const router = Router();
router.use(protect);

const manage = authorize(...FLEET_MANAGERS);

router.get('/stats', manage, getVehicleStats); // keep above '/:id'
router.get('/:id/documents/:filename', manage, getVehicleDocumentProof);
router.route('/')
  .get(manage, getVehicles)
  .post(manage, uploadVehicleProofs, createVehicle);
router.route('/:id')
  .get(manage, getVehicle)
  .put(manage, uploadVehicleProofs, updateVehicle)
  .delete(authorize(ROLES.ADMIN), deleteVehicle);

export default router;
