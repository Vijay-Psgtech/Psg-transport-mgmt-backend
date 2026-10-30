import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';

const days = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

const seeds = [
  { name: 'System Admin', email: 'admin@institute.edu', phone: '9876543212', password: 'Admin@12345', role: 'admin' },
  { name: 'Transport Officer', email: 'officer@institute.edu', phone: '9876543213', password: 'Officer@12345', role: 'transport_officer' },
  {
    name: 'Ravi Kumar', email: 'driver1@institute.edu', password: 'Driver@12345', role: 'driver', phone: '9876543210',
    driverProfile: { licenseNumber: 'TN3820150012345', licenseClass: 'HPMV', licenseExpiry: days(900), badgeNumber: 'PSV-1042', bloodGroup: 'B+', experienceYears: 8 },
  },
  {
    // Licence due in 20 days, handy for seeing the "due soon" badge
    name: 'Murugan S', email: 'driver2@institute.edu', password: 'Driver@12345', role: 'driver', phone: '9876543211',
    driverProfile: { licenseNumber: 'TN3820120067890', licenseClass: 'HMV', licenseExpiry: days(20), bloodGroup: 'O+', experienceYears: 12 },
  },
];

await mongoose.connect(process.env.MONGO_URI);
for (const s of seeds) {
  const existing = await User.findOne({ email: s.email });
  if (!existing) {
    await User.create(s);
    console.log(`Created: ${s.email} (${s.role})`);
  } else {
    const updates = {};
    if (!existing.phone && s.phone) updates.phone = s.phone;
    if (s.driverProfile && !existing.driverProfile?.licenseNumber) updates.driverProfile = s.driverProfile;
    if (Object.keys(updates).length) {
      await User.updateOne({ _id: existing._id }, { $set: updates });
      console.log(`Updated: ${s.email} (completed seed account details)`);
    } else {
      console.log(`Exists:  ${s.email}`);
    }
  }
}
await mongoose.disconnect();
console.log('Seed complete. Change these passwords before deploying.');
