import mongoose from 'mongoose';

const { Schema } = mongoose;

const tripSheetSchema = new Schema(
  {
    assignment: {
      type: Schema.Types.ObjectId,
      ref: 'VehicleAssignment',
      required: true,
      index: true,
    },
    driver: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    tripStartAt: Date,
    tripEndAt: Date,
    startOdometer: { type: Number, min: 0, max: 99999999, required: true },
    endOdometer: {
      type: Number,
      min: 0,
      max: 99999999,
      required: true,
      validate: {
        validator(value) { return value >= this.startOdometer; },
        message: 'End odometer must be greater than or equal to start odometer',
      },
    },
    fuelConsumed: { type: Number, min: 0, max: 100000 },
    notes: { type: String, trim: true, maxlength: 1000 },
    submittedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

tripSheetSchema.index({ assignment: 1, submittedAt: -1 });
tripSheetSchema.index({ driver: 1, submittedAt: -1 });

export default mongoose.model('TripSheet', tripSheetSchema);
