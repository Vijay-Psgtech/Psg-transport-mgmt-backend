import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';

const seeds = [
  { name: 'System Admin', email: 'admin@institute.edu', password: 'Admin@12345', role: 'admin' },
  { name: 'Transport Officer', email: 'officer@institute.edu', password: 'Officer@12345', role: 'transport_officer' },
  { name: 'Ravi Kumar', email: 'driver1@institute.edu', password: 'Driver@12345', role: 'driver', phone: '9876543210' },
  { name: 'Murugan S', email: 'driver2@institute.edu', password: 'Driver@12345', role: 'driver', phone: '9876543211' },
];

await mongoose.connect(process.env.MONGO_URI);
for (const s of seeds) {
  if (await User.findOne({ email: s.email })) {
    console.log(`Exists:  ${s.email}`);
  } else {
    await User.create(s);
    console.log(`Created: ${s.email} (${s.role})`);
  }
}
await mongoose.disconnect();
console.log('Seed complete. Change these passwords before deploying.');
