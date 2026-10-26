import { Router } from 'express';
import { getDashboardReport } from '../controllers/reportController.js';
import { protect, authorize } from '../middleware/auth.js';
import { FLEET_MANAGERS } from '../constants/roles.js';

const router = Router();
router.use(protect);

router.get('/dashboard', authorize(...FLEET_MANAGERS), getDashboardReport);

export default router;
