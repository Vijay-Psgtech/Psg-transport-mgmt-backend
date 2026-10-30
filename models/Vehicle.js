import mongoose from 'mongoose';
import { VEHICLE_TYPES, FUEL_TYPES, VEHICLE_STATUSES, DOCUMENT_TYPES } from '../constants/vehicle.js';

const { Schema } = mongoose;

// Normalise "TN 38 AB 1234" / "tn-38-ab-1234" -> "TN38AB1234"
const normaliseReg = (v) => (typeof v === 'string' ? v.replace(/[\s-]/g, '').toUpperCase() : v);

const documentSchema = new Schema({
  type: { type: String, enum: { values: DOCUMENT_TYPES, message: 'Invalid document type' }, required: true },
  number: { type: String, trim: true },
  issueDate: Date,
  expiryDate: { type: Date, required: [true, 'Document expiry date is required'] },
  proofImage: {
    filename: { type: String, match: /^[\da-f-]{36}$/i },
    mimeType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'] },
  },
});

const vehicleSchema = new Schema(
  {
    vehicleType: {
      type: String,
      enum: { values: VEHICLE_TYPES, message: 'Invalid vehicle type' },
      required: [true, 'Vehicle type is required'],
      index: true,
    },
    regNo: {
      type: String,
      required: [true, 'Registration number is required'],
      unique: true,
      set: normaliseReg,
      match: [/^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/, 'Invalid registration number (e.g. TN38AB1234)'],
    },
    make: { type: String, required: [true, 'Make is required'], trim: true, maxlength: 50 }, // e.g. Ashok Leyland
    model: { type: String, required: [true, 'Model is required'], trim: true, maxlength: 50 }, // e.g. Viking
    manufactureYear: {
      type: Number,
      min: [1990, 'Manufacture year must be 1990 or later'],
      max: [new Date().getFullYear() + 1, 'Manufacture year is in the future'],
    },
    color: { type: String, trim: true, maxlength: 30 },
    fuelType: { type: String, enum: { values: FUEL_TYPES, message: 'Invalid fuel type' }, default: 'diesel' },
    seatingCapacity: {
      type: Number,
      required: [true, 'Seating capacity is required'],
      min: [1, 'Seating capacity must be at least 1'],
      max: [100, 'Seating capacity cannot exceed 100'],
    },
    chassisNo: { type: String, trim: true, uppercase: true, unique: true, sparse: true },
    engineNo: { type: String, trim: true, uppercase: true },
    fastagAvailable: { type: Boolean, default: false },
    fastagIssuingBank: {
      type: String,
      trim: true,
      maxlength: 100,
      required: [function () { return this.fastagAvailable; }, 'FASTag issuing bank is required when FASTag is available'],
    },
    fastagId: {
      type: String,
      trim: true,
      maxlength: 100,
      required: [function () { return this.fastagAvailable; }, 'FASTag ID is required when FASTag is available'],
    },
    fastagStatus: {
      type: String,
      trim: true,
      maxlength: 50,
      required: [function () { return this.fastagAvailable; }, 'FASTag status is required when FASTag is available'],
    },
    odometer: { type: Number, min: [0, 'Odometer cannot be negative'], default: 0 }, // km
    status: {
      type: String,
      enum: { values: VEHICLE_STATUSES, message: 'Invalid status' },
      default: 'active',
      index: true,
    },
    assignedDriver: { type: Schema.Types.ObjectId, ref: 'User', default: undefined },
    gpsDeviceId: { type: String, trim: true },
    documents: [documentSchema],
    notes: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

vehicleSchema.index({ make: 1, model: 1 });

export default mongoose.model('Vehicle', vehicleSchema);
