import Vehicle from '../models/Vehicle.js';
import User from '../models/User.js';
import { ROLES } from '../constants/roles.js';
import { VEHICLE_TYPES, VEHICLE_STATUSES } from '../constants/vehicle.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

const FIELDS = [
  'vehicleType', 'regNo', 'make', 'model', 'manufactureYear', 'color', 'fuelType',
  'seatingCapacity', 'chassisNo', 'engineNo', 'odometer', 'status', 'assignedDriver',
  'gpsDeviceId', 'notes',
];
const SORTABLE = ['createdAt', 'regNo', 'seatingCapacity', 'manufactureYear'];
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const blank = (v) => v === '' || v === null || v === undefined;

// Whitelist body fields (prevents mass assignment); empty strings become undefined (unset)
function extract(body) {
  const out = {};
  for (const key of FIELDS) {
    if (key in body) out[key] = blank(body[key]) ? undefined : body[key];
  }
  if ('documents' in body) {
    out.documents = Array.isArray(body.documents)
      ? body.documents.map((d) => ({
          type: d.type,
          number: blank(d.number) ? undefined : d.number,
          issueDate: blank(d.issueDate) ? undefined : d.issueDate,
          expiryDate: blank(d.expiryDate) ? undefined : d.expiryDate,
        }))
      : [];
  }
  return out;
}

// Assigned user must be an active driver who is not already on another vehicle
async function assertDriverAvailable(driverId, vehicleId) {
  if (!driverId) return;
  const driver = await User.findOne({ _id: driverId, role: ROLES.DRIVER, isActive: true });
  if (!driver) throw new ApiError(400, 'Selected user is not an active driver');
  const clash = await Vehicle.findOne({ assignedDriver: driverId, ...(vehicleId && { _id: { $ne: vehicleId } }) });
  if (clash) throw new ApiError(409, `${driver.name} is already assigned to ${clash.regNo}`);
}

// GET /api/vehicles?page=&limit=&search=&vehicleType=&status=&sortBy=&order=
export const getVehicles = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
  const { search, vehicleType, status, sortBy, order } = req.query;

  const filter = {};
  if (VEHICLE_TYPES.includes(vehicleType)) filter.vehicleType = vehicleType;
  if (VEHICLE_STATUSES.includes(status)) filter.status = status;
  if (typeof search === 'string' && search.trim()) {
    const text = new RegExp(escapeRegex(search.trim()), 'i');
    const reg = new RegExp(escapeRegex(search.replace(/[\s-]/g, '')), 'i');
    filter.$or = [{ regNo: reg }, { make: text }, { model: text }];
  }

  const sortField = SORTABLE.includes(sortBy) ? sortBy : 'createdAt';
  const sort = { [sortField]: order === 'asc' ? 1 : -1 };

  const [data, total] = await Promise.all([
    Vehicle.find(filter)
      .populate('assignedDriver', 'name phone')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    Vehicle.countDocuments(filter),
  ]);

  res.json({ data, pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) } });
});

// GET /api/vehicles/stats
export const getVehicleStats = asyncHandler(async (_req, res) => {
  const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const [total, byStatus, byType, docsDue] = await Promise.all([
    Vehicle.countDocuments(),
    Vehicle.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Vehicle.aggregate([{ $group: { _id: '$vehicleType', count: { $sum: 1 } } }]),
    Vehicle.countDocuments({ documents: { $elemMatch: { expiryDate: { $lte: soon } } } }),
  ]);
  const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.count]));
  res.json({ data: { total, byStatus: toMap(byStatus), byType: toMap(byType), docsDue } });
});

// GET /api/vehicles/:id
export const getVehicle = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findById(req.params.id).populate('assignedDriver', 'name phone');
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');
  res.json({ data: vehicle });
});

// POST /api/vehicles
export const createVehicle = asyncHandler(async (req, res) => {
  const fields = extract(req.body);
  await assertDriverAvailable(fields.assignedDriver);
  const vehicle = await Vehicle.create({ ...fields, createdBy: req.user._id });
  await vehicle.populate('assignedDriver', 'name phone');
  res.status(201).json({ data: vehicle });
});

// PUT /api/vehicles/:id
export const updateVehicle = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findById(req.params.id);
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');

  const fields = extract(req.body);
  await assertDriverAvailable(fields.assignedDriver, vehicle._id);
  vehicle.set(fields);
  await vehicle.save(); // runs schema validators
  await vehicle.populate('assignedDriver', 'name phone');
  res.json({ data: vehicle });
});

// DELETE /api/vehicles/:id  (admin only)
export const deleteVehicle = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findByIdAndDelete(req.params.id);
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');
  res.json({ message: 'Vehicle deleted' });
});
