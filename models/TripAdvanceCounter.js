import mongoose from 'mongoose';

const tripAdvanceCounterSchema = new mongoose.Schema(
  {
    _id: { type: String },
    sequence: { type: Number, required: true, default: 0, min: 0 },
  },
  { versionKey: false }
);

export default mongoose.model('TripAdvanceCounter', tripAdvanceCounterSchema);
