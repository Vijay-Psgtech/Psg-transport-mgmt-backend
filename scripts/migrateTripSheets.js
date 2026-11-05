import 'dotenv/config';
import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import TripSheet from '../models/TripSheet.js';
import VehicleAssignment from '../models/VehicleAssignment.js';

function migrationId(assignmentId, source, index) {
  const hex = createHash('sha256').update(`${assignmentId}:${source}:${index}`).digest('hex').slice(0, 24);
  return new mongoose.Types.ObjectId(hex);
}

function buildEntry(sheet, assignment, source, index) {
  if (!assignment.driver || !assignment.vehicle) {
    throw new Error(`Assignment ${assignment._id} has a legacy trip sheet but no driver or vehicle`);
  }
  if (!Number.isFinite(sheet.startOdometer) || !Number.isFinite(sheet.endOdometer)) {
    throw new Error(`Assignment ${assignment._id} has a legacy trip sheet with invalid odometer readings`);
  }

  return {
    _id: migrationId(assignment._id, source, index),
    assignment: assignment._id,
    driver: assignment.driver,
    vehicle: assignment.vehicle,
    ...(sheet.tripStartAt && { tripStartAt: sheet.tripStartAt }),
    ...(sheet.tripEndAt && { tripEndAt: sheet.tripEndAt }),
    startOdometer: sheet.startOdometer,
    endOdometer: sheet.endOdometer,
    ...(sheet.fuelConsumed !== undefined && { fuelConsumed: sheet.fuelConsumed }),
    ...(sheet.notes && { notes: sheet.notes }),
    submittedAt: sheet.submittedAt || assignment.updatedAt || assignment.createdAt || new Date(),
  };
}

async function migrateTripSheets() {
  await connectDB();
  const collection = mongoose.connection.db.collection(VehicleAssignment.collection.name);
  const cursor = collection.find(
    { $or: [{ tripSheets: { $exists: true } }, { tripSheet: { $exists: true } }] },
    { projection: { driver: 1, vehicle: 1, tripSheets: 1, tripSheet: 1, createdAt: 1, updatedAt: 1 } }
  );
  let migratedAssignments = 0;
  let migratedEntries = 0;

  for await (const assignment of cursor) {
    const entries = [
      ...(assignment.tripSheets || []).map((sheet, index) => buildEntry(sheet, assignment, 'tripSheets', index)),
      ...(assignment.tripSheet ? [buildEntry(assignment.tripSheet, assignment, 'tripSheet', 0)] : []),
    ];

    if (entries.length) {
      await TripSheet.bulkWrite(entries.map((entry) => ({
        updateOne: {
          filter: { _id: entry._id },
          update: { $setOnInsert: entry },
          upsert: true,
        },
      })));
      migratedEntries += entries.length;
    }

    await collection.updateOne(
      { _id: assignment._id },
      { $unset: { tripSheets: '', tripSheet: '' } }
    );
    migratedAssignments += 1;
  }

  console.log(`Migrated ${migratedEntries} trip sheet entr${migratedEntries === 1 ? 'y' : 'ies'} from ${migratedAssignments} assignments.`);
}

migrateTripSheets()
  .catch((error) => {
    console.error('Trip sheet migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
