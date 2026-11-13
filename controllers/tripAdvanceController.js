import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';
import TripAdvance from '../models/TripAdvance.js';
import TripAdvanceCounter from '../models/TripAdvanceCounter.js';
import VehicleAssignment from '../models/VehicleAssignment.js';
import writeTripAdvanceReceipt from '../utils/tripAdvanceReceiptPdf.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ROLES } from '../constants/roles.js';

const POPULATE = [
  { path: 'driver', select: 'name phone' },
  { path: 'vehicle', select: 'regNo make model' },
  { path: 'reviewedBy', select: 'name' },
];

function parseDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(400, `${label} must use YYYY-MM-DD format`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ApiError(400, `${label} is invalid`);
  }
  return date;
}

function parseText(value, label, maxLength, required = true) {
  if (typeof value !== 'string') {
    if (!required && value == null) return '';
    throw new ApiError(400, `${label} must be text`);
  }
  const text = value.trim();
  if (required && !text) throw new ApiError(400, `${label} is required`);
  if (text.length > maxLength) throw new ApiError(400, `${label} must be ${maxLength} characters or fewer`);
  return text;
}

function parseAmount(value, label) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100) {
    throw new ApiError(400, `${label} must be a positive amount with at most two decimal places`);
  }
  return amount;
}

export async function generateReceiptNo(year) {
  const counter = await TripAdvanceCounter.findOneAndUpdate(
    { _id: `TAR-${year}` },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return `TAR-${year}-${String(counter.sequence).padStart(5, '0')}`;
}

// GET /api/trip-advances?page=&limit=&status=
export const listTripAdvances = asyncHandler(async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
  const filter = {};

  if (req.user.role === ROLES.DRIVER) {
    filter.driver = req.user._id;
  } else if (req.user.role === ROLES.TRANSPORT_OFFICER) {
    if (['pending', 'approved', 'rejected'].includes(req.query.status)) filter.status = req.query.status;
  } else {
    throw new ApiError(403, 'You do not have permission to view advance requests', 'FORBIDDEN');
  }

  const [data, total, assignment] = await Promise.all([
    TripAdvance.find(filter)
      .populate(POPULATE)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    TripAdvance.countDocuments(filter),
    req.user.role === ROLES.DRIVER
      ? VehicleAssignment.findOne({ driver: req.user._id, status: 'assigned' })
        .populate('vehicle', 'regNo make model')
        .select('vehicle')
      : null,
  ]);
  res.json({
    data,
    ...(req.user.role === ROLES.DRIVER && { assignedVehicle: assignment?.vehicle || null }),
    pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) },
  });
});

// POST /api/trip-advances
export const createTripAdvance = asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw new ApiError(400, 'Advance request data must be an object');
  }
  const destination = parseText(req.body.destination, 'Trip destination', 160);
  const purpose = parseText(req.body.purpose, 'Trip purpose', 300);
  const departureDate = parseDate(req.body.departureDate, 'Departure date');
  const returnDate = parseDate(req.body.returnDate, 'Return date');
  if (returnDate < departureDate) throw new ApiError(400, 'Return date must be on or after departure date');

  const assignment = await VehicleAssignment.findOne({ driver: req.user._id, status: 'assigned' })
    .populate('vehicle', 'regNo');
  if (!assignment?.vehicle) {
    throw new ApiError(400, 'You need an active vehicle assignment before requesting a trip advance');
  }

  const advance = await TripAdvance.create({
    driver: req.user._id,
    vehicle: assignment.vehicle._id,
    destination,
    purpose,
    departureDate,
    returnDate,
    requestedAmount: parseAmount(req.body.requestedAmount, 'Requested amount'),
    remarks: parseText(req.body.remarks, 'Remarks', 1000, false),
  });
  await advance.populate(POPULATE);
  res.status(201).json({ data: advance });
});

// PATCH /api/trip-advances/:id/decision
export const decideTripAdvance = asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw new ApiError(400, 'Approval decision data must be an object');
  }
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, 'Advance request ID is invalid');
  const status = req.body.status;
  if (!['approved', 'rejected'].includes(status)) {
    throw new ApiError(400, 'Approval status must be approved or rejected');
  }

  const officerRemarks = parseText(req.body.officerRemarks, 'Officer remarks', 1000, false);
  const now = new Date();
  const update = {
    status,
    officerRemarks,
    reviewedBy: req.user._id,
    decisionDate: now,
  };
  if (status === 'approved') {
    const advance = await TripAdvance.findById(req.params.id).select('requestedAmount status');
    if (!advance) throw new ApiError(404, 'Advance request not found');
    if (advance.status !== 'pending') throw new ApiError(409, 'This advance request has already been reviewed');
    const approvedAmount = parseAmount(req.body.approvedAmount, 'Approved amount');
    if (approvedAmount > advance.requestedAmount) {
      throw new ApiError(400, 'Approved amount cannot exceed the requested amount');
    }
    update.approvedAmount = approvedAmount;
    update.approvedDate = now;
    update.receiptNo = await generateReceiptNo(now.getFullYear());
    update.rejectionReason = '';
  } else {
    update.rejectionReason = parseText(req.body.rejectionReason, 'Rejection reason', 1000);
    update.approvedAmount = undefined;
    update.approvedDate = undefined;
    update.receiptNo = undefined;
  }

  const result = await TripAdvance.findOneAndUpdate(
    { _id: req.params.id, status: 'pending' },
    { $set: update },
    { new: true, runValidators: true }
  ).populate(POPULATE);
  if (!result) throw new ApiError(409, 'This advance request has already been reviewed');
  res.json({ data: result });
});

// GET /api/trip-advances/:id/receipt
export const downloadTripAdvanceReceipt = asyncHandler(async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, 'Advance request ID is invalid');
  const advance = await TripAdvance.findById(req.params.id).populate(POPULATE);
  if (!advance) throw new ApiError(404, 'Advance request not found');
  if (req.user.role === ROLES.DRIVER && !advance.driver?._id.equals(req.user._id)) {
    throw new ApiError(403, 'You can only download your own advance receipts', 'FORBIDDEN');
  }
  if (advance.status !== 'approved') {
    throw new ApiError(409, 'A receipt is available only for an approved advance');
  }
  if (!advance.receiptNo || !advance.approvedAmount) {
    throw new ApiError(409, 'The approved advance receipt is not ready');
  }

  const doc = new PDFDocument({ size: 'A4', margin: 52 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${advance.receiptNo}.pdf"`);
  doc.on('error', next);
  doc.pipe(res);
  writeTripAdvanceReceipt(doc, advance);
});
