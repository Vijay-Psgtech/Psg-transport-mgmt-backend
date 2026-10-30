import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLE_LIST, ROLES } from '../constants/roles.js';
import { BLOOD_GROUPS, LICENSE_CLASSES } from '../constants/user.js';

const phoneRule = [/^\+?[\d\s-]{7,15}$/, 'Enter a valid phone number'];
const strip = (v) => (typeof v === 'string' ? v.replace(/[\s-]/g, '').toUpperCase() : v);

// Driver-only fields are required only when the user's role is "driver"
const forDrivers = (label) => [
  function isDriver() { return this.role === ROLES.DRIVER; },
  `${label} is required for drivers`,
];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 100 },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      set: (v) => (typeof v === 'string' && !v.trim() ? undefined : v),
      match: [/^\S+@\S+\.\S+$/, 'Enter a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      validate: {
        validator: (v) => /[A-Za-z]/.test(v) && /\d/.test(v),
        message: 'Password must include at least one letter and one number',
      },
      select: false,
    },
    role: { type: String, enum: { values: ROLE_LIST, message: 'Invalid role' }, default: ROLES.STUDENT, index: true },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      sparse: true,
      trim: true,
      set: (v) => (typeof v === 'string' ? v.replace(/[\s-]/g, '') : v),
      match: phoneRule,
    },
    idNumber: { type: String, trim: true, uppercase: true, unique: true, sparse: true }, // staff / student / employee ID
    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    passwordChangedAt: Date,
    lastLoginAt: Date,

    driverProfile: {
      licenseNumber: { type: String, set: strip, required: forDrivers('Licence number') },
      licenseClass: { type: String, enum: { values: LICENSE_CLASSES, message: 'Invalid licence class' }, required: forDrivers('Licence class') },
      licenseExpiry: { type: Date, required: forDrivers('Licence expiry date') },
      badgeNumber: { type: String, trim: true },
      bloodGroup: { type: String, enum: { values: BLOOD_GROUPS, message: 'Invalid blood group' } },
      dateOfBirth: Date,
      dateOfJoining: Date,
      experienceYears: { type: Number, min: [0, 'Experience cannot be negative'], max: [60, 'Experience looks too high'] },
      address: { type: String, trim: true, maxlength: 300 },
      emergencyContactName: { type: String, trim: true, maxlength: 100 },
      emergencyContactPhone: { type: String, trim: true, match: phoneRule },
    },
  },
  { timestamps: true }
);

userSchema.index({ 'driverProfile.licenseNumber': 1 }, { unique: true, sparse: true });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
  // Tokens issued before this moment stop working (1s margin so tokens issued right after still pass)
  if (!this.isNew) this.passwordChangedAt = new Date(Date.now() - 1000);
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// iat is the JWT "issued at" time in seconds
userSchema.methods.changedPasswordAfter = function (iat) {
  return Boolean(this.passwordChangedAt) && Math.floor(this.passwordChangedAt.getTime() / 1000) > iat;
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.passwordChangedAt;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('User', userSchema);
