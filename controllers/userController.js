import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';
import { ROLES, ROLE_LIST } from '../constants/roles.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

const PROFILE_FIELDS = [
  'licenseNumber', 'licenseClass', 'licenseExpiry', 'badgeNumber', 'bloodGroup', 'dateOfBirth',
  'dateOfJoining', 'experienceYears', 'address', 'emergencyContactName', 'emergencyContactPhone',
];
const SORTABLE = ['name', 'createdAt', 'role'];
const blank = (v) => v === '' || v === null || v === undefined;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const clean = (v) => (blank(v) ? undefined : v);

// Admin manages every role. A transport officer manages drivers only.
function assertCanManage(actor, role) {
  if (actor.role === ROLES.ADMIN) return;
  if (role !== ROLES.DRIVER) {
    throw new ApiError(403, 'Transport officers can only manage driver accounts', 'FORBIDDEN');
  }
}

function extractProfile(body) {
  const src = body.driverProfile && typeof body.driverProfile === 'object' ? body.driverProfile : {};
  return Object.fromEntries(PROFILE_FIELDS.map((k) => [k, clean(src[k])]));
}

// A driver who is deactivated, deleted or changes role must not stay assigned to a vehicle
async function releaseDriver(userId) {
  const res = await Vehicle.updateMany({ assignedDriver: userId }, { $unset: { assignedDriver: 1 } });
  return res.modifiedCount;
}

// Adds the vehicle each driver is currently assigned to
async function withVehicles(users) {
  const ids = users.filter((u) => u.role === ROLES.DRIVER).map((u) => u._id);
  const vehicles = ids.length
    ? await Vehicle.find({ assignedDriver: { $in: ids } }).select('regNo vehicleType assignedDriver')
    : [];
  const byDriver = new Map(
    vehicles.map((v) => [String(v.assignedDriver), { _id: v._id, regNo: v.regNo, vehicleType: v.vehicleType }])
  );
  return users.map((u) => ({ ...u.toJSON(), assignedVehicle: byDriver.get(String(u._id)) || null }));
}

async function findManageable(req) {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  assertCanManage(req.user, user.role);
  return user;
}

// GET /api/users/lookup?role=driver  -> light list for dropdowns (active users only)
export const lookupUsers = asyncHandler(async (req, res) => {
  const filter = { isActive: true };
  if (ROLE_LIST.includes(req.query.role)) filter.role = req.query.role;
  const users = await User.find(filter).select('name phone role driverProfile.licenseExpiry').sort('name');
  res.json({ data: users });
});

// GET /api/users?page&limit&search&role&status&sortBy&order
export const listUsers = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
  const { search, role, status, sortBy, order } = req.query;

  const filter = {};
  if (req.user.role !== ROLES.ADMIN) filter.role = ROLES.DRIVER; // officers only ever see drivers
  else if (ROLE_LIST.includes(role)) filter.role = role;
  if (status === 'active') filter.isActive = true;
  if (status === 'inactive') filter.isActive = false;
  if (typeof search === 'string' && search.trim()) {
    const rx = new RegExp(escapeRegex(search.trim()), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }, { idNumber: rx }, { 'driverProfile.licenseNumber': rx }];
  }

  const sortField = SORTABLE.includes(sortBy) ? sortBy : 'createdAt';
  const sort = { [sortField]: order === 'asc' ? 1 : -1 };

  const [users, total] = await Promise.all([
    User.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);

  res.json({
    data: await withVehicles(users),
    pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) },
  });
});

// GET /api/users/stats
export const getUserStats = asyncHandler(async (req, res) => {
  const base = req.user.role === ROLES.ADMIN ? {} : { role: ROLES.DRIVER };
  const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const [total, active, byRole, licenseDue] = await Promise.all([
    User.countDocuments(base),
    User.countDocuments({ ...base, isActive: true }),
    User.aggregate([{ $match: base }, { $group: { _id: '$role', count: { $sum: 1 } } }]),
    User.countDocuments({ role: ROLES.DRIVER, isActive: true, 'driverProfile.licenseExpiry': { $lte: soon } }),
  ]);
  res.json({
    data: { total, active, byRole: Object.fromEntries(byRole.map((r) => [r._id, r.count])), licenseDue },
  });
});

// GET /api/users/:id
export const getUser = asyncHandler(async (req, res) => {
  const user = await findManageable(req);
  res.json({ data: (await withVehicles([user]))[0] });
});

// POST /api/users
export const createUser = asyncHandler(async (req, res) => {
  const body = req.body;
  const role = body.role || (req.user.role === ROLES.ADMIN ? ROLES.STUDENT : ROLES.DRIVER);
  assertCanManage(req.user, role);
  if (typeof body.password !== 'string') throw new ApiError(400, 'Password is required');

  const user = await User.create({
    name: clean(body.name),
    email: clean(body.email),
    phone: clean(body.phone),
    idNumber: clean(body.idNumber),
    password: body.password,
    role,
    mustChangePassword: true, // the admin knows the first password, so the user must replace it
    ...(role === ROLES.DRIVER && { driverProfile: extractProfile(body) }),
  });
  res.status(201).json({ data: (await withVehicles([user]))[0], message: 'User created' });
});

// PUT /api/users/:id
export const updateUser = asyncHandler(async (req, res) => {
  const user = await findManageable(req);
  const body = req.body;
  const isSelf = user._id.equals(req.user._id);
  const wasDriver = user.role === ROLES.DRIVER;

  let newRole = user.role;
  if (!blank(body.role) && body.role !== user.role) {
    if (req.user.role !== ROLES.ADMIN) throw new ApiError(403, 'Only an administrator can change roles', 'FORBIDDEN');
    if (isSelf) throw new ApiError(400, 'You cannot change your own role');
    newRole = body.role;
  }

  for (const key of ['name', 'email', 'phone', 'idNumber']) {
    if (key in body) user.set(key, clean(body[key]));
  }
  user.role = newRole;

  // Set each profile field explicitly so cleared fields are really removed
  const profile = extractProfile(body);
  for (const key of PROFILE_FIELDS) {
    user.set(`driverProfile.${key}`, newRole === ROLES.DRIVER ? profile[key] : undefined);
  }

  await user.save(); // runs schema validators (licence fields required for drivers)

  const released = wasDriver && newRole !== ROLES.DRIVER ? await releaseDriver(user._id) : 0;
  res.json({
    data: (await withVehicles([user]))[0],
    message: released ? 'User updated. The driver was removed from their vehicle.' : 'User updated',
  });
});

// PATCH /api/users/:id/status  { isActive: boolean }
export const setUserStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') throw new ApiError(400, 'isActive must be true or false');

  const user = await findManageable(req);
  if (user._id.equals(req.user._id)) throw new ApiError(400, 'You cannot deactivate your own account');

  // updateOne avoids re-validating older records that may lack newer required fields
  await User.updateOne({ _id: user._id }, { isActive });
  user.isActive = isActive;

  const released = !isActive && user.role === ROLES.DRIVER ? await releaseDriver(user._id) : 0;
  res.json({
    data: (await withVehicles([user]))[0],
    message: released ? 'Account deactivated. The driver was removed from their vehicle.' : isActive ? 'Account activated' : 'Account deactivated',
  });
});

// POST /api/users/:id/reset-password  { password }
export const resetUserPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (typeof password !== 'string' || !password) throw new ApiError(400, 'A new password is required');

  const user = await findManageable(req);
  user.password = password;
  user.mustChangePassword = true;
  await user.validate(['password']); // password policy
  await user.save({ validateBeforeSave: false }); // hashes it, ends the user's current sessions
  res.json({ message: 'Password reset. The user must change it at next sign in.' });
});

// DELETE /api/users/:id  (admin only)
export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  if (user._id.equals(req.user._id)) throw new ApiError(400, 'You cannot delete your own account');

  if (user.role === ROLES.DRIVER) await releaseDriver(user._id);
  await user.deleteOne();
  res.json({ message: 'User deleted' });
});
