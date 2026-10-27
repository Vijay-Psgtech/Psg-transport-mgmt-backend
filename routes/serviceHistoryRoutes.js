import { Router } from 'express';
import {
  createServiceRecord, deleteServiceRecord, getServiceHistory, getServiceHistoryStats, updateServiceRecord,
} from '../controllers/serviceHistoryController.js';
import { authorize, protect } from '../middleware/auth.js';
import { FLEET_MANAGERS, ROLES } from '../constants/roles.js';

const router = Router();
router.use(protect, authorize(...FLEET_MANAGERS));

router.get('/stats', getServiceHistoryStats);
router.route('/')
  .get(getServiceHistory)
  .post(createServiceRecord);
router.route('/:id')
  .put(updateServiceRecord)
  .delete(authorize(ROLES.ADMIN), deleteServiceRecord);

export default router;
