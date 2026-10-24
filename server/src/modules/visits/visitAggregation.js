import { activeTokenStatuses } from '../tokens/queueToken.model.js';

// Aggregation expressions shared by visit lists, patient summaries, and statistics. They operate
// on QueueToken documents, which are the source of truth for visits.

// The token's visit ID; for tokens created before visits existed, the same ID is derived from the
// patient and the issue date in the hospital time zone (see visit.model.js → buildVisitId).
export const visitKeyExpression = (timeZone) => ({
  $ifNull: [
    '$visitId',
    {
      $concat: [
        'visit_',
        { $dateToString: { date: '$issuedAt', format: '%Y%m%d', timezone: timeZone } },
        '_',
        { $toString: '$patientId' },
      ],
    },
  ],
});

export const localDateExpression = (field, timeZone) => ({
  $dateToString: { date: field, format: '%Y-%m-%d', timezone: timeZone },
});

// The staff member who started the consultation: the actor of the most recent recorded change to
// `in_consultation`. Null when no such change was recorded (for example, tokens changed before
// status history existed).
export const consultedByExpression = {
  $let: {
    vars: {
      starts: {
        $filter: {
          input: { $ifNull: ['$statusHistory', []] },
          as: 'change',
          cond: { $eq: ['$$change.toStatus', 'in_consultation'] },
        },
      },
    },
    in: { $ifNull: [{ $last: '$$starts.actorId' }, null] },
  },
};

export const countWhere = (condition) => ({ $sum: { $cond: [condition, 1, 0] } });
export const isActiveStatus = { $in: ['$status', activeTokenStatuses] };

// Visit status derived from its tokens:
//   in_progress   — at least one token is still waiting, called, or in consultation
//   completed     — no active token and at least one consultation completed
//   not_completed — every token ended as skipped or cancelled
export const visitStatusExpression = {
  $switch: {
    branches: [
      { case: { $gt: ['$activeTokens', 0] }, then: 'in_progress' },
      { case: { $gt: ['$completedTokens', 0] }, then: 'completed' },
    ],
    default: 'not_completed',
  },
};
