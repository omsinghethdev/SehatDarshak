import { useCallback } from 'react';
import { Activity, History } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ErrorState } from '../../components/feedback/ErrorState';
import { LoadingState } from '../../components/feedback/LoadingState';
import { Notice } from '../../components/feedback/Notice';
import { SelectField } from '../../components/forms/SelectField';
import { PageHeader } from '../../components/layout/PageHeader';
import { AuditEntryList } from '../../features/admin/AuditEntryList';
import { ACTION_LABELS, TARGET_LABELS } from '../../features/admin/adminLabels';
import { adminService } from '../../features/admin/adminService';
import { Pagination, RefreshingRegion, SectionHeading, useFilterParams, usePageParam } from '../../features/admin/adminUi';
import { useReferenceData } from '../../features/admin/useReferenceData';
import { StatusBadge } from '../../features/queue/StatusBadge';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateTime } from '../../lib/serviceDates';
import { cn } from '../../utils/cn';

const PAGE_SIZE = 20;
const TABS = [
  { key: 'admin', label: 'Administrative actions', icon: Activity },
  { key: 'queue', label: 'Queue status changes', icon: History },
];

function AdminActions({ names }) {
  const [searchParams, setFilter] = useFilterParams();
  const [page, setPage] = usePageParam();
  const targetType = searchParams.get('targetType') ?? '';
  const action = searchParams.get('action') ?? '';
  const load = useCallback(
    (signal) => adminService.listAdminActions({ targetType: targetType || undefined, action: action || undefined, page, limit: PAGE_SIZE, signal }),
    [targetType, action, page],
  );
  const entries = useAsyncData(load);

  return (
    <section aria-labelledby="admin-actions" className="space-y-4">
      <SectionHeading id="admin-actions" title="Administrative actions" description="Account, ward, and visit changes made by administrators, newest first. Passwords and personal field values are never recorded." />
      <div className="grid gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-2">
        <SelectField id="audit-target" label="Record type" value={targetType} onChange={(event) => setFilter('targetType', event.target.value)} placeholder="All records" options={Object.entries(TARGET_LABELS).map(([value, label]) => ({ value, label }))} />
        <SelectField id="audit-action" label="Action" value={action} onChange={(event) => setFilter('action', event.target.value)} placeholder="All actions" options={Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }))} />
      </div>
      {entries.status === 'error' ? <ErrorState error={entries.error} onRetry={entries.reload} />
        : !entries.data ? <LoadingState label="Loading activity…" />
          : entries.data.items.length === 0 ? (
            <EmptyState icon={Activity} title={targetType || action ? 'No actions match these filters' : 'No administrative actions yet'} description="Actions appear here when administrators create or change accounts, wards, or visits." />
          ) : (
            <RefreshingRegion refreshing={entries.status === 'loading'}>
              <div className="space-y-4">
                <AuditEntryList entries={entries.data.items} names={names} />
                <Pagination meta={entries.data.meta} onPage={setPage} label="actions" />
              </div>
            </RefreshingRegion>
          )}
    </section>
  );
}

function QueueChanges({ reference }) {
  const [searchParams, setFilter] = useFilterParams();
  const [page, setPage] = usePageParam();
  const departmentId = searchParams.get('departmentId') ?? '';
  const supported = adminService.capabilities.queueStatusHistory;
  const load = useCallback(
    (signal) => (supported
      ? adminService.listQueueStatusChanges({ departmentId: departmentId || undefined, page, limit: PAGE_SIZE, signal })
      : Promise.resolve(null)),
    [supported, departmentId, page],
  );
  const entries = useAsyncData(load);

  return (
    <section aria-labelledby="queue-changes" className="space-y-4">
      <SectionHeading id="queue-changes" title="Queue status changes" description="Every successful call-next and token status change, with who made it. No patient identity is included." />
      {!supported ? (
        <Notice tone="info" title="Not available in demo mode">
          The demo queue in this browser does not record who changed a token, so there is no status history to show.
          With the hospital service connected, this list shows every recorded change.
        </Notice>
      ) : (
        <>
          <div className="rounded-xl border border-line bg-white p-4 sm:max-w-sm">
            <SelectField id="queue-audit-department" label="Department" value={departmentId} onChange={(event) => setFilter('departmentId', event.target.value)} placeholder="All departments" options={reference.departmentOptions} />
          </div>
          {entries.status === 'error' ? <ErrorState error={entries.error} onRetry={entries.reload} />
            : !entries.data ? <LoadingState label="Loading queue history…" />
              : entries.data.items.length === 0 ? <EmptyState icon={History} title="No status changes recorded" description="Changes appear when staff call or update tokens." />
                : (
                  <div className="space-y-4">
                    <ol className="divide-y divide-line rounded-xl border border-line bg-white">
                      {entries.data.items.map((entry) => (
                        <li key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                          <span className="font-bold text-slate-900">{entry.displayNumber}</span>
                          <span className="text-sm text-slate-700">{reference.names.departments.get(entry.departmentId) ?? entry.departmentId}</span>
                          <span className="flex items-center gap-2 text-sm">
                            <StatusBadge status={entry.fromStatus} /> <span aria-hidden="true">→</span><span className="sr-only">to</span> <StatusBadge status={entry.toStatus} />
                          </span>
                          <span className="text-sm text-slate-700">{entry.action === 'call_next' ? 'Called next' : 'Status update'} by a {entry.actor.role}</span>
                          <time dateTime={entry.occurredAt} className="text-sm text-slate-600 sm:ml-auto">{formatDateTime(entry.occurredAt)}</time>
                        </li>
                      ))}
                    </ol>
                    <Pagination meta={entries.data.meta} onPage={setPage} label="changes" />
                  </div>
                )}
        </>
      )}
    </section>
  );
}

export function ActivityPage() {
  useDocumentTitle('Activity & audit');
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'queue' ? 'queue' : 'admin';
  const reference = useReferenceData();

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administration" title="Activity & audit" description="Read-only history. Audit records cannot be edited or deleted." />
      <div role="group" aria-label="Activity type" className="flex flex-wrap gap-2">
        {TABS.map((item) => {
          const Icon = item.icon;
          const selected = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={selected}
              onClick={() => setSearchParams(item.key === 'admin' ? {} : { tab: item.key })}
              className={cn(
                'inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm font-semibold',
                selected ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-400 bg-white text-slate-800 hover:bg-brand-50',
              )}
            >
              <Icon aria-hidden="true" className="size-4" />
              {item.label}
            </button>
          );
        })}
      </div>
      {tab === 'admin' ? <AdminActions names={reference.names} /> : <QueueChanges reference={reference} />}
    </div>
  );
}
