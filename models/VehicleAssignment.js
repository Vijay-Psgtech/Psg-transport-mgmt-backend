import mongoose from 'mongoose';
import { VEHICLE_TYPES } from '../constants/vehicle.js';

const { Schema } = mongoose;

const tripFeedbackSchema = new Schema(
  {
    experience: {
      type: String,
      enum: ['good', 'bad'],
      required: true,
    },
    remarks: { type: String, trim: true, maxlength: 1000, default: '' },
    submittedAt: { type: Date, required: true },
  },
  { _id: false }
);

const vehicleAssignmentSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['availability', 'request'],
      required: true,
    },
    vehicle: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: function () { return this.status === 'assigned'; },
    },
    driver: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: function () { return this.status === 'assigned'; },
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: function () { return this.type === 'request'; },
    },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    startAt: {
      type: Date,
      required: function () { return this.type === 'request'; },
    },
    endAt: {
      type: Date,
      required: function () { return this.type === 'request'; },
      validate: {
        validator(value) { return !this.startAt || value > this.startAt; },
        message: 'End time must be after start time',
      },
    },
    purpose: {
      type: String,
      trim: true,
      maxlength: 160,
      required: function () { return this.type === 'request'; },
    },
    preferredVehicleType: {
      type: String,
      enum: VEHICLE_TYPES,
    },
    pickupLocation: {
      type: String,
      trim: true,
      maxlength: 160,
      required: function () { return this.type === 'request'; },
    },
    destination: {
      type: String,
      trim: true,
      maxlength: 160,
      required: function () { return this.type === 'request'; },
    },
    passengerCount: {
      type: Number,
      min: 1,
      max: 100,
      required: function () { return this.type === 'request'; },
    },
    notes: { type: String, trim: true, maxlength: 500 },
    feedback: { type: tripFeedbackSchema, default: undefined },
    status: {
      type: String,
      enum: ['pending', 'assigned', 'rejected', 'cancelled', 'completed'],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true }
);

vehicleAssignmentSchema.index({ status: 1, startAt: 1, endAt: 1 });
vehicleAssignmentSchema.index({ requestedBy: 1, createdAt: -1 });
vehicleAssignmentSchema.index({ vehicle: 1, status: 1, endAt: 1 });
vehicleAssignmentSchema.index({ driver: 1, status: 1, endAt: 1 });

vehicleAssignmentSchema.pre('validate', function () {
  if (this.type === 'availability' && this.status === 'pending') {
    this.invalidate('status', 'Availability assignments must be assigned immediately');
  }
  if (this.type === 'request' && this.status === 'pending' && (this.vehicle || this.driver)) {
    this.invalidate('vehicle', 'Pending requests cannot have a vehicle or driver');
  }
  if (this.type === 'availability' && this.requestedBy) {
    this.invalidate('requestedBy', 'Availability assignments cannot have a requester');
  }
  if (this.type === 'request' && this.status === 'assigned' && !this.assignedBy) {
    this.invalidate('assignedBy', 'An officer is required to assign a request');
  }
});

export default mongoose.model('VehicleAssignment', vehicleAssignmentSchema);
