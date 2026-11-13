import { Router } from 'express';
import { authorize, protect } from '../middleware/auth.js';
import { ROLES } from '../constants/roles.js';
import {
  createTripAdvance,
  decideTripAdvance,
  downloadTripAdvanceReceipt,
  listTripAdvances,
} from '../controllers/tripAdvanceController.js';

const router = Router();
router.use(protect);

router.get('/', listTripAdvances);
router.post('/', authorize(ROLES.DRIVER), createTripAdvance);
router.patch('/:id/decision', authorize(ROLES.TRANSPORT_OFFICER), decideTripAdvance);
router.get('/:id/receipt', authorize(ROLES.DRIVER, ROLES.TRANSPORT_OFFICER), downloadTripAdvanceReceipt);

export default router;
