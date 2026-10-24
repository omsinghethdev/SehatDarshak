import { getHospitalTimeZone } from '../config/hospital.js';
import { QueueToken } from '../modules/tokens/queueToken.model.js';
import { Visit } from '../modules/visits/visit.model.js';
import { visitKeyExpression } from '../modules/visits/visitAggregation.js';

/*
 * Migration: link queue tokens created before visits existed to their visit, and create the
 * missing visit records. Visits are derived only from existing tokens (one per patient per
 * service date); nothing is invented.
 *
 * up   — idempotent; safe to run repeatedly (it only touches tokens without a visitId and only
 *        inserts visit records that do not exist).
 * down — reverses exactly what `up` did: removes `visitId` from tokens it marked, and deletes the
 *        visit records it created, except records an admin has since corrected (those are kept
 *        and counted, because deleting them would lose audited corrections).
 *
 * Indexes are created by Mongoose when the server starts and are not changed by this migration.
 */

const marker = 'visitIdBackfilled';

export async function up({ timeZone = getHospitalTimeZone(), now = new Date() } = {}) {
  const tokens = await QueueToken.collection.updateMany(
    { visitId: { $exists: false } },
    [{ $set: { visitId: visitKeyExpression(timeZone), [marker]: true } }],
  );

  const before = await Visit.countDocuments();
  await QueueToken.collection
    .aggregate([
      { $match: { visitId: { $exists: true } } },
      {
        $group: {
          _id: '$visitId',
          patientId: { $first: '$patientId' },
          firstTokenAt: { $min: '$issuedAt' },
        },
      },
      {
        $project: {
          patientId: 1,
          firstTokenAt: 1,
          serviceDate: { $dateToString: { date: '$firstTokenAt', format: '%Y-%m-%d', timezone: timeZone } },
          source: 'migration',
          createdAt: now,
          updatedAt: now,
        },
      },
      { $merge: { into: Visit.collection.name, on: '_id', whenMatched: 'keepExisting', whenNotMatched: 'insert' } },
    ])
    .toArray();
  const after = await Visit.countDocuments();

  return { tokensLinked: tokens.modifiedCount, visitsCreated: after - before };
}

export async function down() {
  const untouched = {
    source: 'migration',
    auditTrail: { $exists: false },
    wardId: { $exists: false },
    adminNote: { $exists: false },
  };
  const [visitsRemoved, visitsKept] = await Promise.all([
    Visit.collection.deleteMany(untouched),
    Visit.countDocuments({ source: 'migration', $nor: [untouched] }),
  ]);
  const tokens = await QueueToken.collection.updateMany(
    { [marker]: true },
    { $unset: { visitId: '', [marker]: '' } },
  );

  return {
    tokensUnlinked: tokens.modifiedCount,
    visitsRemoved: visitsRemoved.deletedCount,
    visitsKeptBecauseCorrected: visitsKept,
  };
}
