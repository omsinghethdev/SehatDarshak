import { Link } from 'react-router';
import { formatDateTime } from '../../lib/serviceDates';
import { adminStaffPath, adminVisitPath, adminWardPath } from '../../routes/paths';
import { ACTION_LABELS, TARGET_LABELS, describeChange } from './adminLabels';
import { textLink } from './adminUi';

function targetLink(entry) {
  if (entry.targetType === 'staff') return adminStaffPath('staff', entry.targetId);
  if (entry.targetType === 'visit') return adminVisitPath(entry.targetId);
  if (entry.targetType === 'ward') return adminWardPath(entry.targetId);
  return null;
}

/**
 * Administrative audit entries: who did what, to which record, when, and which fields changed.
 * Entries contain no passwords or tokens; personal field values are not recorded by the server.
 */
export function AuditEntryList({ entries, names, showTarget = true }) {
  return (
    <ol className="divide-y divide-line rounded-xl border border-line bg-white">
      {entries.map((entry) => {
        const href = showTarget ? targetLink(entry) : null;
        const target = entry.targetName ?? (entry.targetType === 'visit' ? entry.targetId : null);
        return (
          <li key={entry.id} className="p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="font-semibold text-slate-900">{ACTION_LABELS[entry.action] ?? entry.action}</p>
              <time dateTime={entry.occurredAt} className="text-sm text-slate-600">{formatDateTime(entry.occurredAt)}</time>
            </div>
            <p className="mt-1 text-sm text-slate-700">
              By {entry.actor?.name ?? 'an administrator'} ({entry.actor?.role ?? 'unknown role'})
              {showTarget && (
                <>
                  {' · '}
                  {TARGET_LABELS[entry.targetType] ?? entry.targetType}
                  {target && ': '}
                  {target && (href ? <Link to={href} className={textLink}>{target}</Link> : target)}
                </>
              )}
            </p>
            {entry.changes?.length > 0 && (
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-slate-700">
                {entry.changes.map((change, index) => (
                  <li key={`${change.field}-${index}`}>{describeChange(change, names)}</li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
