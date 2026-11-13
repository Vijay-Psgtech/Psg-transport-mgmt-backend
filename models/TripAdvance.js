import mongoose from 'mongoose';

const { Schema } = mongoose;

const tripAdvanceSchema = new Schema(
  {
    driver: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    destination: { type: String, trim: true, required: true, maxlength: 160 },
    purpose: { type: String, trim: true, required: true, maxlength: 300 },
    departureDate: { type: Date, required: true },
    returnDate: {
      type: Date,
      required: true,
      validate: {
        validator(value) { return !this.departureDate || value >= this.departureDate; },
        message: 'Return date must be on or after departure date',
      },
    },
    requestedAmount: { type: Number, required: true, min: 0.01 },
    remarks: { type: String, trim: true, maxlength: 1000 },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    approvedAmount: { type: Number, min: 0.01 },
    officerRemarks: { type: String, trim: true, maxlength: 1000 },
    rejectionReason: { type: String, trim: true, maxlength: 1000 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedDate: Date,
    decisionDate: Date,
    receiptNo: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

tripAdvanceSchema.index({ driver: 1, createdAt: -1 });
tripAdvanceSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('TripAdvance', tripAdvanceSchema);
