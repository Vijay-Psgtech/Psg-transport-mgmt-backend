import ServiceRecord from '../models/ServiceRecord.js';
import Vehicle from '../models/Vehicle.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

const SERVICE_TYPES = ['routine', 'oil_change', 'repair', 'inspection', 'tyres', 'battery', 'other'];
const SERVICE_STATUSES = ['completed', 'scheduled', 'in_progress', 'cancelled'];
const SORTABLE = ['serviceDate', 'cost', 'odometer', 'createdAt'];
const FIELDS = [
  'vehicle', 'serviceType', 'status', 'serviceDate', 'odometer', 'provider',
  'workDescription', 'cost', 'nextServiceDate', 'nextServiceOdometer', 'notes',
];
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function extract(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'Service record data must be an object');
  }
  const fields = {};
  for (const field of FIELDS) {
    if (Object.hasOwn(body, field)) fields[field] = body[field] === '' ? undefined : body[field];
  }
  return fields;
}

async function assertVehicleExists(vehicleId) {
  const vehicle = await Vehicle.findById(vehicleId).select('_id');
  if (!vehicle) throw new ApiError(400, 'Select a valid vehicle');
}

// GET /api/service-history?page=&limit=&search=&vehicle=&serviceType=&status=&from=&to=
export const getServiceHistory = asyncHandler(async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 100);
  const { search, vehicle, serviceType, status, from, to, sortBy, order } = req.query;
  const filter = {};

  if (typeof vehicle === 'string' && vehicle) filter.vehicle = vehicle;
  if (SERVICE_TYPES.includes(serviceType)) filter.serviceType = serviceType;
  if (SERVICE_STATUSES.includes(status)) filter.status = status;
  if (typeof from === 'string' && from) {
    const date = new Date(from);
    if (Number.isNaN(date.getTime())) throw new ApiError(400, 'Invalid start date');
    filter.serviceDate = { ...filter.serviceDate, $gte: date };
  }
  if (typeof to === 'string' && to) {
    const date = new Date(to);
    if (Number.isNaN(date.getTime())) throw new ApiError(400, 'Invalid end date');
    date.setUTCHours(23, 59, 59, 999);
    filter.serviceDate = { ...filter.serviceDate, $lte: date };
  }
  if (filter.serviceDate?.$gte && filter.serviceDate?.$lte && filter.serviceDate.$gte > filter.serviceDate.$lte) {
    throw new ApiError(400, 'Start date must be on or before end date');
  }
  if (typeof search === 'string' && search.trim()) {
    const term = new RegExp(escapeRegex(search.trim()), 'i');
    const vehicles = await Vehicle.find({ $or: [{ regNo: term }, { make: term }, { model: term }] }).distinct('_id');
    filter.$or = [
      { provider: term },
      { workDescription: term },
      ...(vehicles.length ? [{ vehicle: { $in: vehicles } }] : []),
    ];
  }

  const sortField = SORTABLE.includes(sortBy) ? sortBy : 'serviceDate';
  const sort = { [sortField]: order === 'asc' ? 1 : -1, _id: -1 };
  const [data, total] = await Promise.all([
    ServiceRecord.find(filter)
      .populate('vehicle', 'regNo make model vehicleType')
      .populate('createdBy', 'name')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    ServiceRecord.countDocuments(filter),
  ]);
  res.json({ data, pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) } });
});

// GET /api/service-history/stats
export const getServiceHistoryStats = asyncHandler(async (_req, res) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const next30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const [totals, byStatus, dueSoon] = await Promise.all([
    ServiceRecord.aggregate([
      { $group: {
        _id: null,
        total: { $sum: 1 },
        totalSpend: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$cost', 0] } },
        monthSpend: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'completed'] }, { $gte: ['$serviceDate', monthStart] }, { $lte: ['$serviceDate', now] }] }, '$cost', 0] } },
      } },
    ]),
    ServiceRecord.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ServiceRecord.countDocuments({
      status: { $in: ['scheduled', 'in_progress'] },
      $or: [
        { nextServiceDate: { $gte: now, $lte: next30 } },
        { serviceDate: { $gte: now, $lte: next30 } },
      ],
    }),
  ]);
  res.json({
    data: {
      total: totals[0]?.total || 0,
      totalSpend: totals[0]?.totalSpend || 0,
      monthSpend: totals[0]?.monthSpend || 0,
      dueSoon,
      byStatus: Object.fromEntries(byStatus.map((row) => [row._id, row.count])),
    },
  });
});

// POST /api/service-history
export const createServiceRecord = asyncHandler(async (req, res) => {
  const fields = extract(req.body);
  await assertVehicleExists(fields.vehicle);
  const record = await ServiceRecord.create({ ...fields, createdBy: req.user._id });
  await record.populate('vehicle', 'regNo make model vehicleType');
  res.status(201).json({ data: record });
});

// PUT /api/service-history/:id
export const updateServiceRecord = asyncHandler(async (req, res) => {
  const record = await ServiceRecord.findById(req.params.id);
  if (!record) throw new ApiError(404, 'Service record not found');
  const fields = extract(req.body);
  if (fields.vehicle) await assertVehicleExists(fields.vehicle);
  record.set(fields);
  await record.save();
  await record.populate('vehicle', 'regNo make model vehicleType');
  res.json({ data: record });
});

// DELETE /api/service-history/:id
export const deleteServiceRecord = asyncHandler(async (req, res) => {
  const record = await ServiceRecord.findByIdAndDelete(req.params.id);
  if (!record) throw new ApiError(404, 'Service record not found');
  res.json({ message: 'Service record deleted' });
});
