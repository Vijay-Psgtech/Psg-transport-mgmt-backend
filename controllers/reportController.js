import Vehicle from '../models/Vehicle.js';
import User from '../models/User.js';
import { ROLES } from '../constants/roles.js';
import asyncHandler from '../utils/asyncHandler.js';

const DAY = 24 * 60 * 60 * 1000;
const toMap = (rows) => Object.fromEntries(rows.map((r) => [String(r._id), r.count]));
const sum = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);

// Expiry bucket for a date field: expired | due30 | due90 | valid | unknown (no date recorded)
const expiryBucket = (field, now, in30, in90) => ({
  $switch: {
    branches: [
      { case: { $in: [{ $type: field }, ['missing', 'null']] }, then: 'unknown' },
      { case: { $lt: [field, now] }, then: 'expired' },
      { case: { $lt: [field, in30] }, then: 'due30' },
      { case: { $lt: [field, in90] }, then: 'due90' },
    ],
    default: 'valid',
  },
});

const AGE_BANDS = [
  { label: '0-2 yrs', min: 0, max: 2 },
  { label: '3-5 yrs', min: 3, max: 5 },
  { label: '6-8 yrs', min: 6, max: 8 },
  { label: '9-12 yrs', min: 9, max: 12 },
  { label: '13+ yrs', min: 13, max: Infinity },
];
const EXPERIENCE_ORDER = ['0-2 yrs', '3-5 yrs', '6-9 yrs', '10-14 yrs', '15+ yrs', 'unknown'];

// GET /api/reports/dashboard  (admin, transport officer)
export const getDashboardReport = asyncHandler(async (req, res) => {
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * DAY);
  const in90 = new Date(now.getTime() + 90 * DAY);
  const isAdmin = req.user.role === ROLES.ADMIN;

  const experience = '$driverProfile.experienceYears';

  const [[v], [d], assignedVehicles, vehiclesDocsDue, vehicleAlerts, driverAlerts, roleRows] = await Promise.all([
    Vehicle.aggregate([
      {
        $facet: {
          total: [{ $count: 'n' }],
          byType: [{ $group: { _id: '$vehicleType', count: { $sum: 1 } } }],
          seats: [{ $match: { status: 'active' } }, { $group: { _id: '$vehicleType', count: { $sum: '$seatingCapacity' } } }],
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          byFuel: [{ $group: { _id: '$fuelType', count: { $sum: 1 } } }],
          byYear: [{ $match: { manufactureYear: { $type: 'number' } } }, { $group: { _id: '$manufactureYear', count: { $sum: 1 } } }],
          docs: [
            { $unwind: '$documents' },
            {
              $group: {
                _id: { type: '$documents.type', bucket: expiryBucket('$documents.expiryDate', now, in30, in90) },
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]),
    User.aggregate([
      { $match: { role: ROLES.DRIVER } },
      {
        $facet: {
          status: [{ $group: { _id: '$isActive', count: { $sum: 1 } } }],
          licence: [
            { $match: { isActive: true } },
            { $group: { _id: expiryBucket('$driverProfile.licenseExpiry', now, in30, in90), count: { $sum: 1 } } },
          ],
          classes: [
            { $match: { isActive: true } },
            { $group: { _id: { $ifNull: ['$driverProfile.licenseClass', 'unknown'] }, count: { $sum: 1 } } },
          ],
          experience: [
            { $match: { isActive: true } },
            {
              $group: {
                _id: {
                  $switch: {
                    branches: [
                      { case: { $in: [{ $type: experience }, ['missing', 'null']] }, then: 'unknown' },
                      { case: { $lt: [experience, 3] }, then: '0-2 yrs' },
                      { case: { $lt: [experience, 6] }, then: '3-5 yrs' },
                      { case: { $lt: [experience, 10] }, then: '6-9 yrs' },
                      { case: { $lt: [experience, 15] }, then: '10-14 yrs' },
                    ],
                    default: '15+ yrs',
                  },
                },
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]),
    Vehicle.countDocuments({ assignedDriver: { $exists: true, $ne: null } }),
    Vehicle.countDocuments({ documents: { $elemMatch: { expiryDate: { $lte: in30 } } } }),
    // Soonest vehicle documents that are expired or expire within 30 days
    Vehicle.aggregate([
      { $unwind: '$documents' },
      { $match: { 'documents.expiryDate': { $lte: in30 } } },
      { $sort: { 'documents.expiryDate': 1 } },
      { $limit: 8 },
      { $project: { _id: 0, regNo: 1, type: '$documents.type', expiry: '$documents.expiryDate' } },
    ]),
    User.find({ role: ROLES.DRIVER, isActive: true, 'driverProfile.licenseExpiry': { $lte: in30 } })
      .sort({ 'driverProfile.licenseExpiry': 1 })
      .limit(8)
      .select('name driverProfile.licenseExpiry'),
    isAdmin ? User.aggregate([{ $group: { _id: { role: '$role', active: '$isActive' }, count: { $sum: 1 } } }]) : [],
  ]);

  // ---- vehicles ----
  const byType = toMap(v.byType);
  const seatsByType = toMap(v.seats);
  const byStatus = toMap(v.byStatus);
  const thisYear = now.getFullYear();
  const ageBuckets = AGE_BANDS.map(({ label, min, max }) => ({
    label,
    count: v.byYear
      .filter((r) => {
        const age = Math.max(thisYear - r._id, 0);
        return age >= min && age <= max;
      })
      .reduce((a, r) => a + r.count, 0),
  }));
  const docs = {};
  for (const row of v.docs) {
    const { type, bucket } = row._id;
    docs[type] ??= { expired: 0, due30: 0, due90: 0, valid: 0, unknown: 0 };
    docs[type][bucket] = row.count;
  }
  const totalVehicles = v.total[0]?.n || 0;

  // ---- drivers ----
  const driverStatus = toMap(d.status); // keys are "true" / "false"
  const activeDrivers = driverStatus.true || 0;
  const licence = { expired: 0, due30: 0, due90: 0, valid: 0, unknown: 0, ...toMap(d.licence) };
  const expMap = toMap(d.experience);
  const assignedDrivers = Math.min(assignedVehicles, activeDrivers);

  // ---- needs attention: vehicle documents and driver licences, soonest first ----
  const attention = [
    ...vehicleAlerts.map((a) => ({ kind: 'vehicle', title: a.regNo, docType: a.type, expiry: a.expiry })),
    ...driverAlerts.map((u) => ({ kind: 'driver', title: u.name, docType: 'licence', expiry: u.driverProfile.licenseExpiry })),
  ]
    .sort((a, b) => new Date(a.expiry) - new Date(b.expiry))
    .slice(0, 8);

  // ---- user accounts (admin only) ----
  let users;
  if (isAdmin) {
    const byRole = {};
    let active = 0;
    let total = 0;
    for (const r of roleRows) {
      byRole[r._id.role] = (byRole[r._id.role] || 0) + r.count;
      total += r.count;
      if (r._id.active) active += r.count;
    }
    users = { total, active, byRole };
  }

  res.json({
    data: {
      generatedAt: now.toISOString(),
      vehicles: {
        total: totalVehicles,
        active: byStatus.active || 0,
        activeSeats: sum(seatsByType),
        docsDue: vehiclesDocsDue,
        assigned: assignedVehicles,
        unassigned: Math.max(totalVehicles - assignedVehicles, 0),
        byType,
        seatsByType,
        byStatus,
        byFuel: toMap(v.byFuel),
        ageBuckets,
        docs,
      },
      drivers: {
        total: sum(driverStatus),
        active: activeDrivers,
        inactive: driverStatus.false || 0,
        assigned: assignedDrivers,
        available: Math.max(activeDrivers - assignedDrivers, 0),
        licence,
        licenceDue: licence.expired + licence.due30,
        byClass: toMap(d.classes),
        experience: EXPERIENCE_ORDER.map((label) => ({ label, count: expMap[label] || 0 })).filter(
          (e) => e.label !== 'unknown' || e.count > 0
        ),
      },
      users,
      attention,
    },
  });
});
