import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

// Verifies the access token and attaches the user to req.user
export const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) throw new ApiError(401, 'Not authenticated', 'NO_TOKEN');

  let payload;
  try {
    payload = jwt.verify(header.slice(7), process.env.JWT_ACCESS_SECRET);
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    throw new ApiError(401, expired ? 'Token expired' : 'Invalid token', expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw new ApiError(401, 'Account not found or disabled', 'TOKEN_INVALID');

  req.user = user;
  next();
});

// RBAC guard: authorize(ROLES.ADMIN, ROLES.TRANSPORT_OFFICER)
export const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission to perform this action', 'FORBIDDEN'));
    }
    next();
  };
