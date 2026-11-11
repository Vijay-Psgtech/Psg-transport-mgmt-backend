import mongoose from 'mongoose';

const { Schema } = mongoose;

const serviceRecordSchema = new Schema(
  {
    vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: [true, 'Vehicle is required'] },
    serviceType: {
      type: String,
      enum: ['preventive', 'oil_change', 'repair', 'adblue', 'tyre_retread', 'fc', 'wheel_alignment', 'battery', 'air_greese', 'water_wash', 'Body_work'],
      required: [true, 'Service type is required'],
    },
    status: {
      type: String,
      enum: ['completed', 'scheduled', 'in_progress', 'cancelled'],
      default: 'completed',
      index: true,
    },
    serviceDate: { type: Date, required: [true, 'Service date is required'] },
    odometer: { type: Number, required: [true, 'Odometer reading is required'], min: [0, 'Odometer cannot be negative'] },
    provider: { type: String, trim: true, maxlength: 120 },
    workDescription: { type: String, required: [true, 'Work description is required'], trim: true, maxlength: 2000 },
    cost: { type: Number, min: [0, 'Cost cannot be negative'], default: 0 },
    nextServiceDate: Date,
    nextServiceOdometer: { type: Number, min: [0, 'Next service odometer cannot be negative'] },
    notes: { type: String, trim: true, maxlength: 1000 },
    invoiceFilename: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

serviceRecordSchema.index({ serviceDate: -1, _id: -1 });
serviceRecordSchema.index({ vehicle: 1, serviceDate: -1 });

export default mongoose.model('ServiceRecord', serviceRecordSchema);
