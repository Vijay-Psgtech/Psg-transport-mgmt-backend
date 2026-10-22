import User from '../models/User.js';
import { ROLE_LIST } from '../constants/roles.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

// GET /api/users?role=driver  -> active users (used for the driver dropdown)
export const listUsers = asyncHandler(async (req, res) => {
  const filter = { isActive: true };
  if (typeof req.query.role === 'string' && ROLE_LIST.includes(req.query.role)) filter.role = req.query.role;
  const users = await User.find(filter).select('name email phone role').sort('name');
  res.json({ data: users });
});

// POST /api/users  (admin only) -> create staff, driver, student accounts
export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone } = req.body;
  if (typeof password !== 'string') throw new ApiError(400, 'Password is required');
  const user = await User.create({ name, email, password, role, phone });
  res.status(201).json({ data: user });
});
