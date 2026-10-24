import { useCallback, useMemo, useRef, useState } from 'react';
import { BedDouble, ListOrdered, Pencil, Plus, Power } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { Button, ButtonLink } from '../../components/common/Button';
import { ConfirmPrompt } from '../../components/feedback/ConfirmPrompt';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ErrorState } from '../../components/feedback/ErrorState';
import { LoadingState } from '../../components/feedback/LoadingState';
import { SuccessMessage } from '../../components/feedback/SuccessMessage';
import { PageHeader } from '../../components/layout/PageHeader';
import { DistributionList } from '../../features/admin/AdminCharts';
import { AuditEntryList } from '../../features/admin/AuditEntryList';
import { PeriodPicker, usePeriod } from '../../features/admin/PeriodPicker';
import { WardForm } from '../../features/admin/WardForm';
import { STAFF_TYPE_LABELS } from '../../features/admin/adminLabels';
import { adminService } from '../../features/admin/adminService';
import { DetailList, SectionHeading, StatCard, accountBadge, formatCount, textLink } from '../../features/admin/adminUi';
import { useReferenceData } from '../../features/admin/useReferenceData';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { describePeriod, formatDateTime } from '../../lib/serviceDates';
import { PATHS, adminDepartmentPath, adminStaffPath, adminWardPath } from '../../routes/paths';

const queueLink = (departmentId) => `${PATHS.staffQueue}?department=${encodeURIComponent(departmentId)}`;
const workforceText = (workforce) =>
  `${formatCount(workforce.doctors.active)} doctors, ${formatCount(workforce.staff.active)} staff active`;

// ---- Departments & wards ---------------------------------------------------------------------

export function DepartmentsWardsPage() {
  useDocumentTitle('Departments & wards');
  const { period } = usePeriod();
  const reference = useReferenceData();
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null);
  const loadStats = useCallback(
    (signal) => (period ? adminService.getStatistics({ period, compare: false, signal }) : new Promise(() => {})),
    [period],
  );
  const stats = useAsyncData(loadStats);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Departments & wards"
        description="Department and ward activity. Departments, rooms, and floors are managed outside the app, so the hospital map and QR codes are not affected by anything here."
      />
      <PeriodPicker />

      <section aria-labelledby="department-comparison" className="space-y-3 rounded-xl border border-line bg-white p-4 sm:p-5">
        <SectionHeading id="department-comparison" title="Visits by department" description={period ? describePeriod(period) : undefined} />
        {stats.status === 'error' ? <ErrorState error={stats.error} onRetry={stats.reload} />
          : !stats.data ? <LoadingState label="Loading activity…" />
            : (
              <DistributionList
                unit="visits"
                emptyText="No department visits in this period."
                rows={stats.data.byDepartment.map((department) => ({
                  id: department.id,
                  label: department.name,
                  href: adminDepartmentPath(department.id),
                  value: department.departmentVisits,
                  detail: `${formatCount(department.consultationsCompleted)} consultations · ${formatCount(department.currentlyWaiting)} waiting now`,
                }))}
              />
            )}
      </section>

      <section aria-labelledby="department-list" className="space-y-3">
        <SectionHeading id="department-list" title="Departments" description="Staffing and the live queue." />
        {reference.status === 'error' ? <ErrorState error={reference.error} onRetry={reference.reload} />
          : reference.status === 'loading' && reference.departments.length === 0 ? <LoadingState label="Loading departments…" />
            : reference.departments.length === 0 ? <EmptyState title="No departments" description="No departments have been set up." />
              : (
                <ul className="grid gap-3 md:grid-cols-2">
                  {reference.departments.map((department) => (
                    <li key={department.id} className="rounded-xl border border-line bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link to={adminDepartmentPath(department.id)} className={`${textLink} text-lg`}>{department.name} ({department.code})</Link>
                        {accountBadge(department.isActive)}
                      </div>
                      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <dt className="text-slate-600">Waiting now</dt><dd className="font-semibold tabular-nums">{formatCount(department.currentQueue.waiting)}</dd>
                        <dt className="text-slate-600">In consultation</dt><dd className="tabular-nums">{formatCount(department.currentQueue.in_consultation)}</dd>
                        <dt className="text-slate-600">Workforce</dt><dd>{workforceText(department.workforce)}</dd>
                        <dt className="text-slate-600">Rooms · wards</dt><dd className="tabular-nums">{formatCount(department.roomCount)} · {formatCount(department.activeWardCount)}</dd>
                      </dl>
                    </li>
                  ))}
                </ul>
              )}
      </section>

      <section aria-labelledby="ward-section" className="space-y-3">
        <SectionHeading
          id="ward-section"
          title="Wards"
          description="Administrative areas such as observation wards. Wards are deactivated, never deleted."
          actions={!creating && (
            <Button onClick={() => { setCreating(true); setCreated(null); }}>
              <Plus aria-hidden="true" className="size-5" />
              Add ward
            </Button>
          )}
        />
        {created && <SuccessMessage title={`Ward “${created.name}” created.`} />}
        {creating && (
          <div className="rounded-xl border border-line bg-white p-5">
            <WardForm
              mode="create"
              reference={reference}
              onCancel={() => setCreating(false)}
              onSubmit={async (payload) => {
                const ward = await adminService.createWard(payload);
                setCreating(false);
                setCreated(ward);
                reference.reload();
              }}
            />
          </div>
        )}
        {reference.status === 'error' ? null
          : reference.wards.length === 0 && reference.status !== 'loading' ? (
            <EmptyState icon={BedDouble} title="No wards yet" description="Add a ward to assign staff and record ward visits." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line bg-white">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <caption className="sr-only">Wards</caption>
                <thead className="border-b border-line bg-canvas-muted text-slate-700">
                  <tr>
                    {['Ward', 'Department', 'Floor', 'Assigned (active)', 'Status'].map((heading) => <th key={heading} scope="col" className="px-4 py-3 font-semibold">{heading}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {reference.wards.map((ward) => (
                    <tr key={ward.id}>
                      <th scope="row" className="px-4 py-2 font-semibold">
                        <Link to={adminWardPath(ward.id)} className={`${textLink} inline-flex min-h-11 items-center`}>{ward.name} ({ward.code})</Link>
                      </th>
                      <td className="px-4 py-2">{ward.departmentName ?? '—'}</td>
                      <td className="px-4 py-2">{ward.floorName ?? '—'}</td>
                      <td className="px-4 py-2 tabular-nums">{ward.activeAssignedStaff.doctors} doctors, {ward.activeAssignedStaff.staff} staff</td>
                      <td className="px-4 py-2">{accountBadge(ward.isActive)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        {stats.data && (
          <div className="rounded-xl border border-line bg-white p-4 sm:p-5">
            <h3 className="mb-3 font-semibold text-slate-900">Visits by ward ({describePeriod(stats.data.period)})</h3>
            <DistributionList
              unit="visits"
              emptyText="No visits were assigned to a ward in this period."
              rows={stats.data.byWard.map((ward) => ({ id: ward.id, label: ward.name ?? ward.id, href: adminWardPath(ward.id), value: ward.visits }))}
            />
          </div>
        )}
      </section>
    </div>
  );
}

// ---- Department detail -----------------------------------------------------------------------

function AssignedStaff({ filter, emptyText }) {
  const load = useCallback((signal) => adminService.listStaff({ ...filter, isActive: true, limit: 100, signal }), [filter]);
  const staff = useAsyncData(load);
  if (staff.status === 'error') return <ErrorState error={staff.error} onRetry={staff.reload} />;
  if (!staff.data) return <LoadingState label="Loading assigned staff…" />;
  if (staff.data.items.length === 0) return <p className="text-sm text-slate-700">{emptyText}</p>;
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-white">
      {staff.data.items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-1">
          <Link to={adminStaffPath(item.staffType, item.id)} className={`${textLink} inline-flex min-h-11 items-center`}>{item.name}</Link>
          <span className="text-sm text-slate-600">{STAFF_TYPE_LABELS[item.staffType]}{item.specialization ? ` · ${item.specialization}` : ''}</span>
        </li>
      ))}
      {staff.data.meta.total > staff.data.items.length && <li className="px-4 py-2 text-sm text-slate-600">Showing {staff.data.items.length} of {staff.data.meta.total}.</li>}
    </ul>
  );
}

export function DepartmentDetailPage() {
  const { departmentId } = useParams();
  const { period } = usePeriod();
  const load = useCallback(
    (signal) => (period ? adminService.getDepartment(departmentId, { period, signal }) : new Promise(() => {})),
    [departmentId, period],
  );
  const department = useAsyncData(load);
  const staffFilter = useMemo(() => ({ departmentId }), [departmentId]);
  useDocumentTitle(department.data?.name ?? 'Department');

  const back = <Link to={PATHS.adminDepartments} className={`${textLink} inline-flex min-h-11 items-center`}>Back to departments & wards</Link>;
  if (department.status === 'error') return <div className="space-y-6">{back}<ErrorState error={department.error} onRetry={department.reload} /></div>;
  if (!department.data) return <div className="space-y-6">{back}<PeriodPicker /><LoadingState label="Loading department…" /></div>;
  const item = department.data;
  const activity = item.activity;
  const periodText = describePeriod(activity.period);

  return (
    <div className="space-y-6">
      {back}
      <PageHeader
        eyebrow="Department"
        title={`${item.name} (${item.code})`}
        description={item.description}
        actions={
          <ButtonLink to={queueLink(item.id)} variant="secondary">
            <ListOrdered aria-hidden="true" className="size-5" />
            Open queue
          </ButtonLink>
        }
      />
      <PeriodPicker />
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Department visits" value={activity.departmentVisits} period={periodText} />
        <StatCard label="Unique patients" value={activity.uniquePatients} period={periodText} />
        <StatCard label="Queue tokens issued" value={activity.tokensIssued} period={periodText} />
        <StatCard label="Consultations completed" value={activity.consultationsCompleted} period={periodText} />
        <StatCard label="Waiting now" value={activity.currentQueue.waiting} period="Now" />
        <StatCard label="Called now" value={activity.currentQueue.called} period="Now" />
        <StatCard label="In consultation now" value={activity.currentQueue.in_consultation} period="Now" />
        <StatCard label="Open assistance requests" value={activity.assistanceRequests.currentlyOpen} period="Now" />
      </dl>

      <section aria-labelledby="dept-token-status" className="space-y-2 rounded-xl border border-line bg-white p-4 sm:p-5">
        <SectionHeading id="dept-token-status" title="Tokens issued, by current status" description={periodText} />
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          {Object.entries(activity.issuedByCurrentStatus).map(([status, count]) => (
            <div key={status} className="flex items-baseline justify-between gap-2 border-b border-line pb-1">
              <dt className="text-slate-600 capitalize">{status.replace('_', ' ')}</dt>
              <dd className="font-semibold tabular-nums">{formatCount(count)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="dept-staff" className="space-y-3">
          <SectionHeading
            id="dept-staff"
            title="Assigned doctors and staff"
            description={`${workforceText(item.workforce)}; ${formatCount(item.workforce.doctors.inactive + item.workforce.staff.inactive)} deactivated`}
          />
          <AssignedStaff filter={staffFilter} emptyText="No active doctors or staff are assigned to this department." />
        </section>
        <section aria-labelledby="dept-places" className="space-y-3">
          <SectionHeading id="dept-places" title="Rooms and wards" />
          <DetailList
            className="rounded-xl border border-line bg-white p-4"
            items={[
              ['Rooms on the map', item.rooms.length ? item.rooms.map((room) => room.name).join(', ') : 'None'],
              ['Wards', item.wards.length ? item.wards.map((ward) => `${ward.name}${ward.isActive ? '' : ' (inactive)'}`).join(', ') : 'None'],
            ]}
          />
          <p className="text-sm text-slate-700">
            <Link to={`${PATHS.adminVisits}?departmentId=${encodeURIComponent(item.id)}`} className={textLink}>View visits for this department</Link>
          </p>
        </section>
      </div>
    </div>
  );
}

// ---- Ward detail -----------------------------------------------------------------------------

export function WardDetailPage() {
  const { wardId } = useParams();
  const reference = useReferenceData();
  const load = useCallback((signal) => adminService.getWard(wardId, { signal }), [wardId]);
  const ward = useAsyncData(load);
  const loadActivity = useCallback((signal) => adminService.listAdminActions({ targetType: 'ward', targetId: wardId, limit: 10, signal }), [wardId]);
  const activity = useAsyncData(loadActivity);
  const staffFilter = useMemo(() => ({ wardId }), [wardId]);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [message, setMessage] = useState(null);
  const statusButtonRef = useRef(null);
  useDocumentTitle(ward.data?.name ?? 'Ward');

  const back = <Link to={PATHS.adminDepartments} className={`${textLink} inline-flex min-h-11 items-center`}>Back to departments & wards</Link>;
  if (ward.status === 'error') return <div className="space-y-6">{back}<ErrorState error={ward.error} onRetry={ward.reload} /></div>;
  if (!ward.data) return <LoadingState label="Loading ward…" />;
  const item = ward.data;

  async function toggleStatus() {
    setPending(true);
    setActionError(null);
    try {
      const updated = await adminService.updateWard(item.id, { isActive: !item.isActive });
      ward.setData((current) => ({ ...current, ...updated }));
      setConfirming(false);
      setMessage(updated.isActive ? 'Ward reactivated.' : 'Ward deactivated. It keeps its history but cannot receive new assignments.');
      activity.reload();
      reference.reload();
      statusButtonRef.current?.focus();
    } catch (error) {
      setActionError(error);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      {back}
      <PageHeader eyebrow="Ward" title={`${item.name} (${item.code})`} description={item.description} actions={accountBadge(item.isActive)} />
      {message && <SuccessMessage title={message} />}

      <section aria-labelledby="ward-details" className="space-y-4 rounded-xl border border-line bg-white p-5 sm:p-6">
        <SectionHeading
          id="ward-details"
          title="Details"
          actions={!editing && (
            <Button variant="secondary" onClick={() => { setEditing(true); setMessage(null); }}>
              <Pencil aria-hidden="true" className="size-4" />
              Edit
            </Button>
          )}
        />
        {editing ? (
          <WardForm
            mode="edit"
            ward={item}
            reference={reference}
            onCancel={() => setEditing(false)}
            onSubmit={async (changes) => {
              const updated = await adminService.updateWard(item.id, changes);
              ward.setData((current) => ({ ...current, ...updated }));
              setEditing(false);
              setMessage('Changes saved.');
              activity.reload();
              reference.reload();
            }}
          />
        ) : (
          <DetailList items={[
            ['Department', item.departmentName],
            ['Floor', item.floorName],
            ['Visits recorded', formatCount(item.visitsRecorded)],
            ['Created', formatDateTime(item.createdAt)],
          ]} />
        )}
      </section>

      <section aria-labelledby="ward-status" className="space-y-3 rounded-xl border border-line bg-white p-5 sm:p-6">
        <SectionHeading id="ward-status" title="Status" description="Deactivated wards keep their visit history but cannot receive new staff or visit assignments." />
        {actionError && <ErrorState error={actionError} />}
        {confirming ? (
          <ConfirmPrompt
            tone={item.isActive ? 'danger' : 'warning'}
            title={item.isActive ? `Deactivate ${item.name}?` : `Reactivate ${item.name}?`}
            confirmLabel={item.isActive ? 'Deactivate ward' : 'Reactivate ward'}
            pending={pending}
            onConfirm={toggleStatus}
            onCancel={() => { setConfirming(false); statusButtonRef.current?.focus(); }}
          >
            {item.isActive ? 'Existing assignments are kept; no new staff or visits can be assigned to it.' : 'Staff and visits can be assigned to it again.'}
          </ConfirmPrompt>
        ) : (
          <Button ref={statusButtonRef} variant={item.isActive ? 'danger' : 'primary'} onClick={() => setConfirming(true)}>
            <Power aria-hidden="true" className="size-4" />
            {item.isActive ? 'Deactivate ward' : 'Reactivate ward'}
          </Button>
        )}
      </section>

      <section aria-labelledby="ward-staff" className="space-y-3">
        <SectionHeading id="ward-staff" title="Assigned doctors and staff" description="Active accounts assigned to this ward. Ward assignment grants no extra access." />
        <AssignedStaff filter={staffFilter} emptyText="No active doctors or staff are assigned to this ward." />
        <p className="text-sm"><Link to={`${PATHS.adminVisits}?wardId=${encodeURIComponent(item.id)}`} className={textLink}>View visits assigned to this ward</Link></p>
      </section>

      <section aria-labelledby="ward-history" className="space-y-3">
        <SectionHeading id="ward-history" title="History" />
        {activity.status === 'error' ? <ErrorState error={activity.error} onRetry={activity.reload} />
          : !activity.data ? <LoadingState label="Loading history…" />
            : activity.data.items.length === 0 ? <p className="text-sm text-slate-700">No changes recorded.</p>
              : <AuditEntryList entries={activity.data.items} names={reference.names} showTarget={false} />}
      </section>
    </div>
  );
}
