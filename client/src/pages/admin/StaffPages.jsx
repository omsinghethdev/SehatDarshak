import { useCallback, useRef, useState } from 'react';
import { KeyRound, Pencil, Plus, Power, Search, UserRound } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { Button, ButtonLink } from '../../components/common/Button';
import { ConfirmPrompt } from '../../components/feedback/ConfirmPrompt';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ErrorState } from '../../components/feedback/ErrorState';
import { LoadingState } from '../../components/feedback/LoadingState';
import { Notice } from '../../components/feedback/Notice';
import { SuccessMessage } from '../../components/feedback/SuccessMessage';
import { SelectField } from '../../components/forms/SelectField';
import { TextField } from '../../components/forms/TextField';
import { PageHeader } from '../../components/layout/PageHeader';
import { AuditEntryList } from '../../features/admin/AuditEntryList';
import { StaffForm } from '../../features/admin/StaffForm';
import { STAFF_TYPE_LABELS } from '../../features/admin/adminLabels';
import { IS_MOCK_ADMIN, adminService } from '../../features/admin/adminService';
import { DetailList, Pagination, RefreshingRegion, SectionHeading, accountBadge, textLink, useFilterParams, usePageParam } from '../../features/admin/adminUi';
import { useReferenceData } from '../../features/admin/useReferenceData';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateTime } from '../../lib/serviceDates';
import { PATHS, adminStaffPath } from '../../routes/paths';

const SECTION = {
  doctor: { title: 'Doctors', singular: 'doctor', add: 'Add doctor', list: PATHS.adminDoctors, create: PATHS.adminDoctorNew },
  staff: { title: 'Staff', singular: 'staff member', add: 'Add staff member', list: PATHS.adminStaff, create: PATHS.adminStaffNew },
};

const PAGE_SIZE = 20;

// ---- List ------------------------------------------------------------------------------------

export function StaffDirectoryPage({ staffType }) {
  const section = SECTION[staffType];
  useDocumentTitle(section.title);
  const [searchParams, setFilter] = useFilterParams();
  const [page, setPage] = usePageParam();
  const reference = useReferenceData();
  const searchRef = useRef(null);

  const filters = {
    q: searchParams.get('q') ?? '',
    departmentId: searchParams.get('departmentId') ?? '',
    wardId: searchParams.get('wardId') ?? '',
    status: searchParams.get('status') ?? '',
  };
  const isActive = filters.status === 'active' ? true : filters.status === 'inactive' ? false : undefined;

  const load = useCallback(
    (signal) => adminService.listStaff({
      staffType,
      q: filters.q || undefined,
      departmentId: filters.departmentId || undefined,
      wardId: filters.wardId || undefined,
      isActive,
      page,
      limit: PAGE_SIZE,
      signal,
    }),
    [staffType, filters.q, filters.departmentId, filters.wardId, isActive, page],
  );
  const list = useAsyncData(load);

  let results;
  if (list.status === 'error') results = <ErrorState error={list.error} onRetry={list.reload} />;
  else if (!list.data) results = <LoadingState label={`Loading ${section.title.toLowerCase()}…`} />;
  else if (list.data.items.length === 0) {
    const filtered = Object.values(filters).some(Boolean);
    results = (
      <EmptyState
        icon={UserRound}
        title={filtered ? `No ${section.title.toLowerCase()} match these filters` : `No ${section.title.toLowerCase()} yet`}
        description={filtered ? 'Try another search or clear the filters.' : `Add the first ${section.singular} to assign them to a department.`}
        action={!filtered && <ButtonLink to={section.create}>{section.add}</ButtonLink>}
      />
    );
  } else {
    results = (
      <RefreshingRegion refreshing={list.status === 'loading'}>
        <div className="space-y-4">
          <StaffTable items={list.data.items} staffType={staffType} />
          <Pagination meta={list.data.meta} onPage={setPage} label={section.title.toLowerCase()} />
        </div>
      </RefreshingRegion>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title={section.title}
        description={staffType === 'doctor'
          ? 'Doctor accounts. Doctors manage the queue and assistance requests of their assigned department.'
          : 'Staff accounts. Staff manage the queue and assistance requests of their assigned department.'}
        actions={
          <ButtonLink to={section.create}>
            <Plus aria-hidden="true" className="size-5" />
            {section.add}
          </ButtonLink>
        }
      />

      <section aria-label="Search and filters" className="space-y-4 rounded-xl border border-line bg-white p-4">
        <form
          role="search"
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setFilter('q', searchRef.current.value.trim());
          }}
        >
          <TextField
            ref={searchRef}
            id="staff-search"
            name="q"
            label="Search"
            hint={staffType === 'doctor' ? 'Name, username, or specialization' : 'Name, username, or specialization'}
            defaultValue={filters.q}
            key={filters.q}
            className="min-w-0 flex-1 basis-64"
          />
          <Button type="submit" variant="secondary">
            <Search aria-hidden="true" className="size-4" />
            Search
          </Button>
        </form>
        <div className="grid gap-3 sm:grid-cols-3">
          <SelectField id="filter-department" label="Department" value={filters.departmentId} onChange={(event) => setFilter('departmentId', event.target.value)} placeholder="All departments" options={reference.departmentOptions} />
          <SelectField id="filter-ward" label="Ward" value={filters.wardId} onChange={(event) => setFilter('wardId', event.target.value)} placeholder="All wards" options={reference.wardOptions} />
          <SelectField
            id="filter-status"
            label="Account status"
            value={filters.status}
            onChange={(event) => setFilter('status', event.target.value)}
            placeholder="All statuses"
            options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Deactivated' }]}
          />
        </div>
        {reference.status === 'error' && <ErrorState error={reference.error} title="Department and ward filters could not be loaded" onRetry={reference.reload} />}
        <p className="text-sm text-slate-600">Sorted by name.</p>
      </section>

      {results}
    </div>
  );
}

function StaffTable({ items, staffType }) {
  const detailColumn = staffType === 'doctor' ? ['Specialization', 'specialization'] : ['Designation', 'designation'];
  return (
    <>
      <ul className="space-y-3 md:hidden">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-line bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link to={adminStaffPath(staffType, item.id)} className={`${textLink} text-lg`}>{item.name}</Link>
              {accountBadge(item.isActive)}
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-slate-600">Username</dt><dd className="break-all text-slate-900">{item.identifier}</dd>
              <dt className="text-slate-600">Department</dt><dd className="text-slate-900">{item.departmentName ?? '—'}</dd>
              <dt className="text-slate-600">Ward</dt><dd className="text-slate-900">{item.wardName ?? '—'}</dd>
              <dt className="text-slate-600">{detailColumn[0]}</dt><dd className="text-slate-900">{item[detailColumn[1]] ?? '—'}</dd>
            </dl>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-xl border border-line bg-white md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{STAFF_TYPE_LABELS[staffType]} accounts</caption>
          <thead className="border-b border-line bg-canvas-muted text-slate-700">
            <tr>
              {['Name', 'Username', 'Department', 'Ward', detailColumn[0], 'Status'].map((heading) => (
                <th key={heading} scope="col" className="px-4 py-3 font-semibold">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((item) => (
              <tr key={item.id}>
                <th scope="row" className="px-4 py-2 font-semibold">
                  <Link to={adminStaffPath(staffType, item.id)} className={`${textLink} inline-flex min-h-11 items-center`}>{item.name}</Link>
                </th>
                <td className="px-4 py-2 break-all text-slate-700">{item.identifier}</td>
                <td className="px-4 py-2">{item.departmentName ?? '—'}</td>
                <td className="px-4 py-2">{item.wardName ?? '—'}</td>
                <td className="px-4 py-2">{item[detailColumn[1]] ?? '—'}</td>
                <td className="px-4 py-2">{accountBadge(item.isActive)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---- Create ----------------------------------------------------------------------------------

export function StaffCreatePage({ staffType }) {
  const section = SECTION[staffType];
  useDocumentTitle(section.add);
  const navigate = useNavigate();
  const reference = useReferenceData();

  let body;
  if (reference.status === 'error') body = <ErrorState error={reference.error} title="Departments could not be loaded" onRetry={reference.reload} />;
  else if (reference.status === 'loading' && reference.departments.length === 0) body = <LoadingState label="Loading departments…" />;
  else if (reference.activeDepartmentOptions.length === 0) {
    body = <Notice tone="warning" title="No active departments">An account needs a department. No active department is available.</Notice>;
  } else {
    body = (
      <div className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <StaffForm
          mode="create"
          staffType={staffType}
          reference={reference}
          onCancel={() => navigate(section.list)}
          onSubmit={async (payload) => {
            const created = await adminService.createStaff(payload);
            navigate(adminStaffPath(created.staffType, created.id), { state: { notice: 'created' } });
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={section.title}
        title={section.add}
        description="Only administrators can create staff and doctor accounts. There is no public registration for these roles."
      />
      {body}
    </div>
  );
}

// ---- Detail ----------------------------------------------------------------------------------

const NOTICES = {
  created: 'The account has been created.',
  updated: 'Changes saved.',
  deactivated: 'The account has been deactivated. It can no longer sign in, and existing sessions have ended.',
  reactivated: 'The account has been reactivated and can sign in again.',
};

export function StaffDetailPage({ staffType }) {
  const section = SECTION[staffType];
  const { staffId } = useParams();
  const location = useLocation();
  const reference = useReferenceData();
  const [notice, setNotice] = useState(location.state?.notice ?? null);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(null); // 'status' | 'reset'
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [temporaryPassword, setTemporaryPassword] = useState(null);
  const statusButtonRef = useRef(null);
  const resetButtonRef = useRef(null);

  const load = useCallback((signal) => adminService.getStaff(staffId, { signal }), [staffId]);
  const account = useAsyncData(load);
  const loadActivity = useCallback(
    (signal) => adminService.listAdminActions({ targetType: 'staff', targetId: staffId, limit: 10, signal }),
    [staffId],
  );
  const activity = useAsyncData(loadActivity);
  useDocumentTitle(account.data?.name ?? section.title);

  if (account.status === 'error') {
    return (
      <div className="space-y-6">
        <Link to={section.list} className={textLink}>Back to {section.title.toLowerCase()}</Link>
        <ErrorState error={account.error} onRetry={account.reload} />
      </div>
    );
  }
  if (!account.data) return <LoadingState label="Loading account…" />;
  const item = account.data;

  async function run(action) {
    setActionPending(true);
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(error);
    } finally {
      setActionPending(false);
    }
  }

  const toggleStatus = () => run(async () => {
    const updated = await adminService.updateStaff(item.id, { isActive: !item.isActive });
    account.setData(updated);
    setConfirm(null);
    setNotice(updated.isActive ? 'reactivated' : 'deactivated');
    activity.reload();
    statusButtonRef.current?.focus();
  });

  const resetPassword = () => run(async () => {
    const result = await adminService.resetStaffPassword(item.id);
    setConfirm(null);
    setTemporaryPassword(result.temporaryPassword);
    account.reload();
    activity.reload();
  });

  return (
    <div className="space-y-6">
      <Link to={section.list} className={`${textLink} inline-flex min-h-11 items-center`}>Back to {section.title.toLowerCase()}</Link>
      <PageHeader
        eyebrow={STAFF_TYPE_LABELS[item.staffType]}
        title={item.name}
        description={item.departmentName ? `${item.departmentName}${item.wardName ? ` · ${item.wardName}` : ''}` : undefined}
        actions={accountBadge(item.isActive)}
      />

      {item.staffType !== staffType && (
        <Notice tone="info" title={`This account is a ${STAFF_TYPE_LABELS[item.staffType].toLowerCase()}`}>
          <Link to={adminStaffPath(item.staffType, item.id)} className={textLink}>Open it in {SECTION[item.staffType].title}</Link>
        </Notice>
      )}
      {notice && NOTICES[notice] && <SuccessMessage title={NOTICES[notice]} />}
      {!item.isActive && (
        <Notice tone="warning" title="This account is deactivated">
          It cannot sign in, is not counted as active, and cannot manage any queue. Its history (queue
          actions, visits, and audit records) is kept. Reactivate it to restore access.
        </Notice>
      )}
      {item.mustChangePassword && !temporaryPassword && (
        <Notice tone="info" title="Waiting for a new password">
          A temporary password was issued. The account will be asked to choose its own password.
        </Notice>
      )}

      {temporaryPassword && (
        <Notice
          tone="warning"
          role="status"
          title="Temporary password — shown only once"
          action={<Button variant="secondary" onClick={() => setTemporaryPassword(null)}>I have recorded it — hide</Button>}
        >
          <p>Give this password to {item.name} in person. It will not be shown again. Their earlier sessions have ended.</p>
          <p className="mt-2 inline-block rounded border border-amber-300 bg-white px-3 py-1 font-mono text-lg tracking-wide select-all text-slate-900">{temporaryPassword}</p>
          {IS_MOCK_ADMIN && <p className="mt-2">Demo directory: this account cannot sign in, so the password is not usable.</p>}
        </Notice>
      )}

      <section aria-labelledby="account-details" className="space-y-4 rounded-xl border border-line bg-white p-5 sm:p-6">
        <SectionHeading
          id="account-details"
          title="Account details"
          actions={!editing && (
            <Button variant="secondary" onClick={() => { setEditing(true); setNotice(null); }}>
              <Pencil aria-hidden="true" className="size-4" />
              Edit
            </Button>
          )}
        />
        {editing ? (
          reference.status === 'error' ? (
            <ErrorState error={reference.error} title="Departments and wards could not be loaded" onRetry={reference.reload} />
          ) : (
            <StaffForm
              mode="edit"
              staffType={item.staffType}
              account={item}
              reference={reference}
              onCancel={() => setEditing(false)}
              onSubmit={async (changes) => {
                const updated = await adminService.updateStaff(item.id, changes);
                account.setData(updated);
                setEditing(false);
                setNotice('updated');
                activity.reload();
              }}
            />
          )
        ) : (
          <DetailList
            items={[
              ['Username', item.identifier],
              ['Role type', STAFF_TYPE_LABELS[item.staffType]],
              ['Department', item.departmentName],
              ['Ward', item.wardName],
              ['Designation', item.designation],
              item.staffType === 'doctor' && ['Specialization', item.specialization],
              item.staffType === 'doctor' && ['Registration number', item.registrationNumber],
              ['Phone', item.phone],
              ['Email', item.email],
              ['Created', formatDateTime(item.createdAt)],
              ['Last updated', formatDateTime(item.updatedAt)],
            ]}
          />
        )}
      </section>

      <section aria-labelledby="account-access" className="space-y-4 rounded-xl border border-line bg-white p-5 sm:p-6">
        <SectionHeading id="account-access" title="Access" description="Accounts are deactivated, never deleted, so queue and visit history stay intact." />
        {actionError && <ErrorState error={actionError} />}
        {confirm === 'status' ? (
          <ConfirmPrompt
            tone={item.isActive ? 'danger' : 'warning'}
            title={item.isActive ? `Deactivate ${item.name}?` : `Reactivate ${item.name}?`}
            confirmLabel={item.isActive ? 'Deactivate account' : 'Reactivate account'}
            pendingLabel={item.isActive ? 'Deactivating…' : 'Reactivating…'}
            pending={actionPending}
            onConfirm={toggleStatus}
            onCancel={() => { setConfirm(null); statusButtonRef.current?.focus(); }}
          >
            {item.isActive
              ? 'They will be signed out immediately and cannot sign in or manage the queue until reactivated. Their history is kept.'
              : 'They will be able to sign in and manage their department again.'}
          </ConfirmPrompt>
        ) : confirm === 'reset' ? (
          <ConfirmPrompt
            title={`Issue a temporary password for ${item.name}?`}
            confirmLabel="Issue temporary password"
            pendingLabel="Issuing…"
            pending={actionPending}
            onConfirm={resetPassword}
            onCancel={() => { setConfirm(null); resetButtonRef.current?.focus(); }}
          >
            Their current password stops working and every signed-in session ends. The new password is
            shown to you once.
          </ConfirmPrompt>
        ) : (
          <div className="flex flex-wrap gap-3">
            <Button ref={statusButtonRef} variant={item.isActive ? 'danger' : 'primary'} onClick={() => { setConfirm('status'); setNotice(null); }}>
              <Power aria-hidden="true" className="size-4" />
              {item.isActive ? 'Deactivate account' : 'Reactivate account'}
            </Button>
            <Button ref={resetButtonRef} variant="secondary" onClick={() => { setConfirm('reset'); setNotice(null); }}>
              <KeyRound aria-hidden="true" className="size-4" />
              Reset password
            </Button>
          </div>
        )}
      </section>

      <section aria-labelledby="account-activity" className="space-y-4">
        <SectionHeading id="account-activity" title="Account history" description="Creation and changes made by administrators (newest first)." />
        {activity.status === 'error' ? (
          <ErrorState error={activity.error} onRetry={activity.reload} />
        ) : !activity.data ? (
          <LoadingState label="Loading history…" />
        ) : activity.data.items.length === 0 ? (
          <p className="text-sm text-slate-700">No recorded changes.</p>
        ) : (
          <AuditEntryList entries={activity.data.items} names={reference.names} showTarget={false} />
        )}
      </section>
    </div>
  );
}
