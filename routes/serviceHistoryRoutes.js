import { Router } from 'express';
import {
  createServiceRecord, deleteServiceRecord, getServiceHistory, getServiceHistoryStats, getServiceInvoice, updateServiceRecord,
} from '../controllers/serviceHistoryController.js';
import { authorize, protect } from '../middleware/auth.js';
import { FLEET_MANAGERS, ROLES } from '../constants/roles.js';
import uploadServiceInvoice from '../middleware/serviceInvoiceUpload.js';

const router = Router();
router.use(protect, authorize(...FLEET_MANAGERS));

router.get('/stats', getServiceHistoryStats);
router.get('/:id/invoice', getServiceInvoice);
router.route('/')
  .get(getServiceHistory)
  .post(uploadServiceInvoice, createServiceRecord);
router.route('/:id')
  .put(uploadServiceInvoice, updateServiceRecord)
  .delete(authorize(ROLES.ADMIN), deleteServiceRecord);

export default router;
