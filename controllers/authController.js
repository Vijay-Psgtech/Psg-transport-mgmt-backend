import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  REFRESH_COOKIE,
  signAccessToken,
  signRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
} from '../utils/tokens.js';

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  // typeof checks also block NoSQL operator injection such as { "$ne": "" }
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
  const valid = user && (await user.comparePassword(password));
  if (!valid) throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  if (!user.isActive) throw new ApiError(403, 'Your account is deactivated. Contact the administrator.', 'ACCOUNT_DISABLED');

  await User.updateOne({ _id: user._id }, { lastLoginAt: new Date() });

  setRefreshCookie(res, signRefreshToken(user));
  res.json({ accessToken: signAccessToken(user), user });
});

// POST /api/auth/refresh  (uses the httpOnly refresh cookie; also used to restore a session on page load)
export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw new ApiError(401, 'No active session', 'NO_SESSION');

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    clearRefreshCookie(res);
    throw new ApiError(401, 'Session expired. Please sign in again.', 'SESSION_EXPIRED');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) {
    clearRefreshCookie(res);
    throw new ApiError(401, 'Account not found or disabled', 'SESSION_EXPIRED');
  }

  setRefreshCookie(res, signRefreshToken(user)); // sliding session
  res.json({ accessToken: signAccessToken(user), user });
});

// POST /api/auth/logout
export const logout = (_req, res) => {
  clearRefreshCookie(res);
  res.json({ message: 'Signed out' });
};

// GET /api/auth/me
export const me = (req, res) => res.json({ user: req.user });
