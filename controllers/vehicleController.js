import Vehicle from '../models/Vehicle.js';
import User from '../models/User.js';
import { ROLES } from '../constants/roles.js';
import { VEHICLE_TYPES, VEHICLE_STATUSES } from '../constants/vehicle.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { access } from 'node:fs/promises';
import { removeVehicleProofFiles, vehicleProofPath } from '../utils/vehicleProofFiles.js';

const FIELDS = [
  'vehicleType', 'regNo', 'make', 'model', 'manufactureYear', 'color', 'fuelType',
  'seatingCapacity', 'chassisNo', 'engineNo', 'fastagAvailable', 'fastagIssuingBank',
  'fastagId', 'fastagStatus', 'odometer', 'status', 'assignedDriver',
  'gpsDeviceId', 'notes',
];
const SORTABLE = ['createdAt', 'regNo', 'seatingCapacity', 'manufactureYear'];
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const blank = (v) => v === '' || v === null || v === undefined;

// Whitelist body fields (prevents mass assignment); empty strings become undefined (unset)
function extract(body, existingVehicle, uploadedFiles = []) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'Vehicle data must be an object');
  const out = {};
  for (const key of FIELDS) {
    if (key in body) out[key] = blank(body[key]) ? undefined : body[key];
  }
  if ('documents' in body) {
    if (!Array.isArray(body.documents)) throw new ApiError(400, 'Documents must be an array');
    const usedUploads = new Set();
    out.documents = body.documents.map((document) => {
      if (!document || typeof document !== 'object') throw new ApiError(400, 'Invalid document details');
      const doc = {
        type: document.type,
        number: blank(document.number) ? undefined : document.number,
        issueDate: blank(document.issueDate) ? undefined : document.issueDate,
        expiryDate: blank(document.expiryDate) ? undefined : document.expiryDate,
      };
      const previous = existingVehicle?.documents.find(
        (existing) => document._id && existing._id.toString() === document._id
      );
      if (previous) doc._id = previous._id;
      if (!document.removeProof && previous?.proofImage?.filename) doc.proofImage = previous.proofImage;

      if (document.proofUploadIndex !== undefined) {
        const index = Number(document.proofUploadIndex);
        if (!Number.isInteger(index) || index < 0 || index >= uploadedFiles.length || usedUploads.has(index)) {
          throw new ApiError(400, 'Invalid proof image reference');
        }
        usedUploads.add(index);
        doc.proofImage = { filename: uploadedFiles[index].filename, mimeType: uploadedFiles[index].mimetype };
      }
      return doc;
    });
    if (usedUploads.size !== uploadedFiles.length) throw new ApiError(400, 'Every uploaded proof image must belong to a document');
  } else if (uploadedFiles.length) {
    throw new ApiError(400, 'Proof images must be attached to a document');
  }
  return out;
}

const savedProofs = (documents = []) => documents.map((document) => document.proofImage).filter((proof) => proof?.filename);

async function removeNewUploads(req) {
  await removeVehicleProofFiles(req.files || []);
}

async function removeReplacedProofs(previousDocuments, nextDocuments) {
  const retained = new Set(savedProofs(nextDocuments).map((proof) => proof.filename));
  await removeVehicleProofFiles(savedProofs(previousDocuments).filter((proof) => !retained.has(proof.filename)));
}

// Assigned user must be an active driver who is not already on another vehicle
async function assertDriverAvailable(driverId, vehicleId) {
  if (!driverId) return;
  const driver = await User.findOne({ _id: driverId, role: ROLES.DRIVER, isActive: true });
  if (!driver) throw new ApiError(400, 'Selected user is not an active driver');
  const licenceExpiry = driver.driverProfile?.licenseExpiry;
  if (licenceExpiry && licenceExpiry < new Date()) {
    throw new ApiError(400, `${driver.name}'s driving licence has expired`);
  }
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

// GET /api/vehicles/:id/documents/:filename
export const getVehicleDocumentProof = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findById(req.params.id).select('documents');
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');
  const document = vehicle.documents.find((item) => item.proofImage?.filename === req.params.filename);
  if (!document) throw new ApiError(404, 'Document proof not found');

  const proofPath = vehicleProofPath(document.proofImage.filename);
  try {
    await access(proofPath);
  } catch (error) {
    if (error.code === 'ENOENT') throw new ApiError(404, 'Document proof file not found');
    throw error;
  }
  res.type(document.proofImage.mimeType).sendFile(proofPath);
});

// POST /api/vehicles
export const createVehicle = asyncHandler(async (req, res) => {
  let vehicle;
  try {
    const fields = extract(req.body, null, req.files || []);
    await assertDriverAvailable(fields.assignedDriver);
    vehicle = await Vehicle.create({ ...fields, createdBy: req.user._id });
  } catch (error) {
    try {
      await removeNewUploads(req);
    } catch (cleanupError) {
      console.error('Unable to remove unclaimed vehicle proof uploads:', cleanupError);
    }
    throw error;
  }
  await vehicle.populate('assignedDriver', 'name phone');
  res.status(201).json({ data: vehicle });
});

// PUT /api/vehicles/:id
export const updateVehicle = asyncHandler(async (req, res) => {
  let vehicle;
  let previousDocuments;
  let fields;
  try {
    vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) throw new ApiError(404, 'Vehicle not found');
    previousDocuments = vehicle.documents.map((document) => ({
      proofImage: document.proofImage?.toObject?.() || document.proofImage,
    }));
    fields = extract(req.body, vehicle, req.files || []);
    await assertDriverAvailable(fields.assignedDriver, vehicle._id);
    vehicle.set(fields);
    await vehicle.save(); // runs schema validators
  } catch (error) {
    try {
      await removeNewUploads(req);
    } catch (cleanupError) {
      console.error('Unable to remove unclaimed vehicle proof uploads:', cleanupError);
    }
    throw error;
  }
  await removeReplacedProofs(previousDocuments, vehicle.documents);
  await vehicle.populate('assignedDriver', 'name phone');
  res.json({ data: vehicle });
});

// DELETE /api/vehicles/:id  (admin only)
export const deleteVehicle = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findById(req.params.id);
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');
  await vehicle.deleteOne();
  await removeVehicleProofFiles(savedProofs(vehicle.documents));
  res.json({ message: 'Vehicle deleted' });
});
