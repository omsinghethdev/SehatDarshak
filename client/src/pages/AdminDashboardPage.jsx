import { useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../components/common/Button';
import { ErrorState } from '../components/feedback/ErrorState';
import { LoadingState } from '../components/feedback/LoadingState';
import { Notice } from '../components/feedback/Notice';
import { PageHeader } from '../components/layout/PageHeader';
import { DistributionList, TrendChart } from '../features/admin/AdminCharts';
import { AuditEntryList } from '../features/admin/AuditEntryList';
import { OperationalSummary } from '../features/admin/OperationalSummary';
import { PeriodPicker, usePeriod } from '../features/admin/PeriodPicker';
import { adminService } from '../features/admin/adminService';
import { loadAdminOverview } from '../features/admin/adminOverviewService';
import { SectionHeading, StatCard, countOf, formatCount, textLink } from '../features/admin/adminUi';
import { useReferenceData } from '../features/admin/useReferenceData';
import { useAsyncData } from '../hooks/useAsyncData';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { describePeriod, formatDateTime, formatServiceDate } from '../lib/serviceDates';
import { PATHS, adminDepartmentPath, adminStaffPath, adminWardPath } from '../routes/paths';

const TOKEN_STATUS_ROWS = [
  ['waiting', 'Waiting'],
  ['called', 'Called'],
  ['in_consultation', 'In consultation'],
  ['completed', 'Completed'],
  ['skipped', 'Skipped'],
  ['cancelled', 'Cancelled'],
];

function ComparisonTable({ comparison }) {
  const rows = [
    ['Visits', comparison.visits],
    ['Unique patients', comparison.uniqueVisiting],
    ['Queue tokens issued', comparison.tokensIssued],
    ['Consultations completed', comparison.consultationsCompleted],
  ];
  const change = (item) => {
    if (item.change === 0) return 'No change';
    const sign = item.change > 0 ? '+' : '−';
    return `${sign}${formatCount(Math.abs(item.change))}${item.changePercent === null ? '' : ` (${sign}${Math.abs(item.changePercent)}%)`}`;
  };
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full text-left text-sm">
        <caption className="px-4 pt-3 text-left text-sm text-slate-700">
          Compared with the previous {comparison.previousPeriod.days === 1 ? 'day' : `${comparison.previousPeriod.days} days`} ({formatServiceDate(comparison.previousPeriod.from)}
          {comparison.previousPeriod.from !== comparison.previousPeriod.to && ` – ${formatServiceDate(comparison.previousPeriod.to)}`})
        </caption>
        <thead className="border-b border-line text-slate-700">
          <tr>
            <th scope="col" className="px-4 py-2 font-semibold">Measure</th>
            <th scope="col" className="px-4 py-2 text-right font-semibold">This period</th>
            <th scope="col" className="px-4 py-2 text-right font-semibold">Previous</th>
            <th scope="col" className="px-4 py-2 text-right font-semibold">Change</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line tabular-nums">
          {rows.map(([label, item]) => (
            <tr key={label}>
              <th scope="row" className="px-4 py-2 font-medium">{label}</th>
              <td className="px-4 py-2 text-right">{formatCount(item.current)}</td>
              <td className="px-4 py-2 text-right">{formatCount(item.previous)}</td>
              <td className="px-4 py-2 text-right">{change(item)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatisticsView({ stats, names }) {
  const periodText = describePeriod(stats.period);
  return (
    <div className="space-y-8">
      <section aria-labelledby="summary-heading" className="space-y-3">
        <SectionHeading id="summary-heading" title="Summary" description="A visit is one patient on one hospital date. Several queue tokens on the same day are one visit." />
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total visits" value={stats.visits.total} period={periodText} />
          <StatCard label="Unique patients" value={stats.patients.uniqueVisiting} period={periodText} help={`${formatCount(stats.patients.repeatVisitors)} visited more than once`} />
          <StatCard label="Today's visits" value={stats.visits.today} period="Today" />
          <StatCard label="Registered patients" value={stats.patients.registeredTotal} period="All time, as of now" help={`${formatCount(stats.patients.registeredInPeriod)} registered in the period`} />
          <StatCard label="Active doctors" value={stats.workforce.doctors.active} period="Now" help={`${formatCount(stats.workforce.doctors.inactive)} deactivated`} />
          <StatCard label="Active staff" value={stats.workforce.staff.active} period="Now" help={`${formatCount(stats.workforce.staff.inactive)} deactivated`} />
          <StatCard label="Active queue tokens" value={stats.queueTokens.currentlyActive} period="Now" help={`${countOf(stats.queueTokens.currentlyWaiting, 'patients')} waiting`} />
          <StatCard label="Pending assistance requests" value={stats.assistanceRequests.currentlyOpen} period="Now (not yet acknowledged)" />
        </dl>
        {stats.comparison && <ComparisonTable comparison={stats.comparison} />}
      </section>

      <section aria-labelledby="trend-heading" className="space-y-3 rounded-xl border border-line bg-white p-4 sm:p-5">
        <SectionHeading id="trend-heading" title="Visits per day" description={periodText} />
        <TrendChart points={stats.trend.map((day) => ({ date: day.date, value: day.visits }))} seriesLabel="Visits" unit="visits" />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="department-distribution" className="space-y-3 rounded-xl border border-line bg-white p-4 sm:p-5">
          <SectionHeading id="department-distribution" title="Department visits" description="A visit that used two departments counts once in each." />
          <DistributionList
            unit="visits"
            emptyText="No department visits in this period."
            rows={stats.byDepartment.map((department) => ({
              id: department.id,
              label: `${department.name}${department.isActive ? '' : ' (inactive)'}`,
              href: adminDepartmentPath(department.id),
              value: department.departmentVisits,
              detail: countOf(department.uniquePatients, 'patients'),
            }))}
          />
        </section>
        <section aria-labelledby="ward-distribution" className="space-y-3 rounded-xl border border-line bg-white p-4 sm:p-5">
          <SectionHeading id="ward-distribution" title="Ward visits" description="Visits that an administrator assigned to a ward." />
          <DistributionList
            unit="visits"
            emptyText="No visits were assigned to a ward in this period."
            rows={stats.byWard.map((ward) => ({ id: ward.id, label: ward.name ?? ward.id, href: adminWardPath(ward.id), value: ward.visits }))}
          />
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="queue-status" className="space-y-3 rounded-xl border border-line bg-white p-4 sm:p-5">
          <SectionHeading id="queue-status" title="Queue tokens" description={`Tokens issued: ${periodText}`} />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-slate-600">Issued in the period</dt>
              <dd className="text-2xl font-semibold text-slate-900 tabular-nums">{formatCount(stats.queueTokens.issued)}</dd>
            </div>
            {TOKEN_STATUS_ROWS.map(([key, label]) => (
              <div key={key} className="flex items-baseline justify-between gap-2 border-b border-line pb-1">
                <dt className="text-slate-600">{label} now</dt>
                <dd className="font-semibold text-slate-900 tabular-nums">{formatCount(stats.queueTokens.issuedByCurrentStatus[key])}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-slate-700">
            <strong>{countOf(stats.queueTokens.consultationsCompleted, 'consultations')}</strong>{' '}
            {stats.queueTokens.consultationsCompleted === 1 ? 'was' : 'were'} completed in the period. A token is counted as a consultation only when staff mark it completed.
          </p>
        </section>

        <section aria-labelledby="doctor-consultations" className="space-y-3 rounded-xl border border-line bg-white p-4 sm:p-5">
          <SectionHeading id="doctor-consultations" title="Consultations by doctor" description={periodText} />
          {adminService.capabilities.doctorAttribution ? (
            <DistributionList
              unit="consultations"
              emptyText="No consultations were started by a doctor account in this period."
              rows={stats.byDoctor.doctors.map((doctor) => ({
                id: doctor.id,
                label: doctor.name,
                href: adminStaffPath('doctor', doctor.id),
                value: doctor.consultationsCompleted,
                detail: doctor.departmentName ?? undefined,
              }))}
            />
          ) : (
            <Notice tone="info" title="Not available in demo mode">
              The demo queue does not record who started each consultation.
            </Notice>
          )}
          {stats.byDoctor.consultationsNotAttributedToDoctor > 0 && (
            <p className="text-sm text-slate-700">
              {formatCount(stats.byDoctor.consultationsNotAttributedToDoctor)} completed consultations were started by
              general staff, an administrator, or before this was recorded, so they are not attributed to a doctor.
            </p>
          )}
        </section>
      </div>

      <section aria-labelledby="department-table" className="space-y-3">
        <SectionHeading id="department-table" title="Department activity" description={periodText} />
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <caption className="sr-only">Visits, tokens, and consultations by department</caption>
            <thead className="border-b border-line bg-canvas-muted text-slate-700">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Department</th>
                {['Visits', 'Patients', 'Tokens', 'Consultations', 'Skipped', 'Cancelled', 'Waiting now'].map((heading) => (
                  <th key={heading} scope="col" className="px-4 py-3 text-right font-semibold">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {stats.byDepartment.map((department) => (
                <tr key={department.id}>
                  <th scope="row" className="px-4 py-2 font-semibold">
                    <Link to={adminDepartmentPath(department.id)} className={textLink}>{department.name}</Link>
                    {!department.isActive && <span className="font-normal text-slate-600"> (inactive)</span>}
                  </th>
                  {[department.departmentVisits, department.uniquePatients, department.tokensIssued, department.consultationsCompleted, department.skipped, department.cancelled, department.currentlyWaiting].map((value, index) => (
                    <td key={index} className="px-4 py-2 text-right">{formatCount(value)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <RecentActivity names={names} />
    </div>
  );
}

function RecentActivity({ names }) {
  const load = useCallback((signal) => adminService.listAdminActions({ limit: 5, signal }), []);
  const activity = useAsyncData(load);
  return (
    <section aria-labelledby="recent-activity" className="space-y-3">
      <SectionHeading
        id="recent-activity"
        title="Recent administrative activity"
        actions={<Link to={PATHS.adminActivity} className={`${textLink} inline-flex min-h-11 items-center`}>View all activity</Link>}
      />
      {activity.status === 'error' ? (
        <ErrorState error={activity.error} onRetry={activity.reload} />
      ) : !activity.data ? (
        <LoadingState label="Loading activity…" />
      ) : activity.data.items.length === 0 ? (
        <p className="text-sm text-slate-700">No administrative actions have been recorded yet.</p>
      ) : (
        <AuditEntryList entries={activity.data.items} names={names} />
      )}
    </section>
  );
}

export function AdminDashboardPage() {
  useDocumentTitle('Hospital operations');
  const { period, error: periodError } = usePeriod();
  const reference = useReferenceData();

  const loadStats = useCallback(
    (signal) => (period ? adminService.getStatistics({ period, signal }) : new Promise(() => {})),
    [period],
  );
  const stats = useAsyncData(loadStats);
  const loadLive = useCallback((signal) => loadAdminOverview({ signal }), []);
  const live = useAsyncData(loadLive);
  const refreshing = stats.status === 'loading' || live.status === 'loading';

  let content;
  if (periodError) content = null;
  else if (stats.status === 'error') content = <ErrorState error={stats.error} onRetry={stats.reload} />;
  else if (!stats.data) content = <LoadingState label="Calculating statistics…" />;
  else content = <StatisticsView stats={stats.data} names={reference.names} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Hospital operations"
        description="Visits, queues, and staffing for the selected period. Aggregate figures only — no patient details."
        actions={
          <Button variant="secondary" onClick={() => { stats.reload(); live.reload(); }} aria-disabled={refreshing || undefined}>
            <RefreshCw aria-hidden="true" className={refreshing ? 'size-4 animate-spin' : 'size-4'} />
            Refresh
          </Button>
        }
      />
      <PeriodPicker />
      {stats.data && (
        <p className="text-sm text-slate-600">
          Calculated at <time dateTime={stats.data.generatedAt}>{formatDateTime(stats.data.generatedAt)}</time>{' '}
          {adminService.source === 'api' ? 'by the hospital service.' : 'from the demo data in this browser.'}
        </p>
      )}
      {content}

      <section aria-labelledby="live-queues" className="space-y-4 border-t border-line pt-6">
        <SectionHeading id="live-queues" title="Live queues" description="Current queue and assistance-request counts across all departments (not period-based)." />
        {live.status === 'error' ? (
          <ErrorState error={live.error} onRetry={live.reload} />
        ) : !live.data ? (
          <LoadingState label="Loading live queues…" />
        ) : live.data.summary.departments.length === 0 ? (
          <Notice tone="info" title="No departments to show">There are no active departments yet.</Notice>
        ) : (
          <OperationalSummary summary={live.data.summary} />
        )}
      </section>
    </div>
  );
}
