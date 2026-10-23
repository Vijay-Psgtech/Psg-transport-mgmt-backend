import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, refresh, logout, me, updateMe, changePassword } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
});

router.post('/login', loginLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.route('/me').get(protect, me).put(protect, updateMe);
router.put('/change-password', protect, changePassword);

export default router;
