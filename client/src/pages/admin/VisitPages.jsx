import { useCallback, useRef, useState } from 'react';
import { ClipboardList, Search } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { Button } from '../../components/common/Button';
import { ConfirmPrompt } from '../../components/feedback/ConfirmPrompt';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ErrorState } from '../../components/feedback/ErrorState';
import { LoadingState } from '../../components/feedback/LoadingState';
import { Notice } from '../../components/feedback/Notice';
import { SuccessMessage } from '../../components/feedback/SuccessMessage';
import { SelectField } from '../../components/forms/SelectField';
import { TextAreaField } from '../../components/forms/TextAreaField';
import { TextField } from '../../components/forms/TextField';
import { PageHeader } from '../../components/layout/PageHeader';
import { AuditEntryList } from '../../features/admin/AuditEntryList';
import { PeriodPicker, usePeriod } from '../../features/admin/PeriodPicker';
import { VISIT_STATUS_OPTIONS } from '../../features/admin/adminLabels';
import { adminService } from '../../features/admin/adminService';
import { Badge, DetailList, Pagination, RefreshingRegion, SectionHeading, StatCard, formatCount, textLink, useFilterParams, usePageParam } from '../../features/admin/adminUi';
import { useReferenceData } from '../../features/admin/useReferenceData';
import { StatusBadge } from '../../features/queue/StatusBadge';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { describePeriod, formatDateTime, formatServiceDate } from '../../lib/serviceDates';
import { PATHS, adminPatientPath, adminStaffPath, adminVisitPath } from '../../routes/paths';

const PAGE_SIZE = 20;
const ALL_TIME = { key: 'all' };

const VISIT_DEFINITION =
  'A visit is one patient on one hospital date. It can include several queue tokens in different departments. A queue token is not a visit, and only tokens that staff mark completed count as consultations.';

function VisitTable({ items, showPatient = true }) {
  if (items.length === 0) return null;
  return (
    <>
      <ul className="space-y-3 lg:hidden">
        {items.map((visit) => (
          <li key={visit.id} className="rounded-xl border border-line bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link to={adminVisitPath(visit.id)} className={`${textLink} text-lg`}>{formatServiceDate(visit.serviceDate)}</Link>
              <Badge kind={visit.status} />
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {showPatient && (<><dt className="text-slate-600">Patient</dt><dd className="text-slate-900">{visit.patient.name ?? '—'}</dd></>)}
              <dt className="text-slate-600">Departments</dt><dd className="text-slate-900">{visit.departments.map((department) => department.name ?? department.id).join(', ')}</dd>
              <dt className="text-slate-600">Ward</dt><dd className="text-slate-900">{visit.ward?.name ?? '—'}</dd>
              <dt className="text-slate-600">Tokens · consultations</dt><dd className="text-slate-900 tabular-nums">{visit.tokenCount} · {visit.consultationsCompleted}</dd>
            </dl>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-xl border border-line bg-white lg:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Visits</caption>
          <thead className="border-b border-line bg-canvas-muted text-slate-700">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Date</th>
              {showPatient && <th scope="col" className="px-4 py-3 font-semibold">Patient</th>}
              <th scope="col" className="px-4 py-3 font-semibold">Departments</th>
              <th scope="col" className="px-4 py-3 font-semibold">Ward</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Tokens</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Consultations</th>
              <th scope="col" className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((visit) => (
              <tr key={visit.id}>
                <th scope="row" className="px-4 py-2 font-semibold">
                  <Link to={adminVisitPath(visit.id)} className={`${textLink} inline-flex min-h-11 flex-col justify-center`}>
                    {formatServiceDate(visit.serviceDate)}
                    <span className="text-xs font-normal text-slate-600 no-underline">first token {formatDateTime(visit.firstTokenAt)}</span>
                  </Link>
                </th>
                {showPatient && (
                  <td className="px-4 py-2">
                    {visit.patient.name ?? '—'}
                    {visit.patient.identifier && <span className="block text-xs text-slate-600">{visit.patient.identifier}</span>}
                  </td>
                )}
                <td className="px-4 py-2">{visit.departments.map((department) => department.name ?? department.id).join(', ')}</td>
                <td className="px-4 py-2">{visit.ward?.name ?? '—'}</td>
                <td className="px-4 py-2 text-right tabular-nums">{visit.tokenCount}</td>
                <td className="px-4 py-2 text-right tabular-nums">{visit.consultationsCompleted}</td>
                <td className="px-4 py-2"><Badge kind={visit.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PatientSearch() {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const load = useCallback(
    (signal) => (query ? adminService.searchPatients({ q: query, limit: 10, signal }) : Promise.resolve(null)),
    [query],
  );
  const results = useAsyncData(load);

  return (
    <section aria-labelledby="patient-search" className="space-y-3 rounded-xl border border-line bg-white p-4">
      <h2 id="patient-search" className="font-semibold text-slate-900">Find a patient</h2>
      <form role="search" className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); setQuery(inputRef.current.value.trim()); }}>
        <TextField ref={inputRef} id="patient-q" label="Username, name, or patient ID" className="min-w-0 flex-1 basis-64" />
        <Button type="submit" variant="secondary">
          <Search aria-hidden="true" className="size-4" />
          Search patients
        </Button>
      </form>
      <div aria-live="polite">
        {query && (results.status === 'error' ? (
          <ErrorState error={results.error} onRetry={results.reload} />
        ) : !results.data ? (
          <LoadingState label="Searching…" className="py-4" />
        ) : results.data.items.length === 0 ? (
          <p className="text-sm text-slate-700">No patients match “{query}”.</p>
        ) : (
          <ul className="divide-y divide-line">
            {results.data.items.map((patient) => (
              <li key={patient.id} className="flex flex-wrap items-center justify-between gap-2 py-1">
                <Link to={adminPatientPath(patient.id)} className={`${textLink} inline-flex min-h-11 items-center`}>{patient.name}</Link>
                <span className="text-sm text-slate-600">{patient.identifier}</span>
              </li>
            ))}
            {results.data.meta.total > results.data.items.length && (
              <li className="py-2 text-sm text-slate-600">Showing the first {results.data.items.length} of {results.data.meta.total}. Refine the search to narrow it down.</li>
            )}
          </ul>
        ))}
      </div>
    </section>
  );
}

export function VisitsPage() {
  useDocumentTitle('Patients & visits');
  const { period } = usePeriod('last30Days');
  const [searchParams, setFilter] = useFilterParams();
  const [page, setPage] = usePageParam();
  const reference = useReferenceData();
  const filters = {
    departmentId: searchParams.get('departmentId') ?? '',
    wardId: searchParams.get('wardId') ?? '',
    doctorId: searchParams.get('doctorId') ?? '',
    status: searchParams.get('status') ?? '',
  };

  const loadDoctors = useCallback((signal) => adminService.listStaff({ staffType: 'doctor', limit: 100, signal }), []);
  const doctors = useAsyncData(loadDoctors);
  const loadSummary = useCallback(
    (signal) => (period ? adminService.getStatistics({ period, compare: false, signal }) : new Promise(() => {})),
    [period],
  );
  const summary = useAsyncData(loadSummary);
  const { departmentId, wardId, doctorId, status } = filters;
  const loadVisits = useCallback(
    (signal) => (period
      ? adminService.listVisits({
        period,
        departmentId: departmentId || undefined,
        wardId: wardId || undefined,
        doctorId: doctorId || undefined,
        status: status || undefined,
        page,
        limit: PAGE_SIZE,
        signal,
      })
      : new Promise(() => {})),
    [period, departmentId, wardId, doctorId, status, page],
  );
  const visits = useAsyncData(loadVisits);
  const filtered = Object.values(filters).some(Boolean);

  let list;
  if (!period) list = null;
  else if (visits.status === 'error') list = <ErrorState error={visits.error} onRetry={visits.reload} />;
  else if (!visits.data) list = <LoadingState label="Loading visits…" />;
  else if (visits.data.items.length === 0) {
    list = <EmptyState icon={ClipboardList} title={filtered ? 'No visits match these filters' : 'No visits in this period'} description={filtered ? 'Try another filter or period.' : 'Visits appear when patients receive queue tokens.'} />;
  } else {
    list = (
      <RefreshingRegion refreshing={visits.status === 'loading'}>
        <div className="space-y-4">
          <VisitTable items={visits.data.items} />
          <Pagination meta={visits.data.meta} onPage={setPage} label="visits" />
        </div>
      </RefreshingRegion>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administration" title="Patients & visits" description={VISIT_DEFINITION} />
      <PeriodPicker defaultPeriod="last30Days" />

      {period && (
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy={summary.status === 'loading'}>
          {summary.status === 'error' ? (
            <div className="col-span-full"><ErrorState error={summary.error} onRetry={summary.reload} /></div>
          ) : (
            <>
              <StatCard label="Total visits" value={summary.data?.visits.total} period={describePeriod(period)} />
              <StatCard label="Unique patients" value={summary.data?.patients.uniqueVisiting} period={describePeriod(period)} />
              <StatCard label="Repeat visitors" value={summary.data?.patients.repeatVisitors} period="Patients with more than one visit" />
              <StatCard label="Department visits" value={summary.data?.visits.departmentVisits} period="One per visit per department" />
            </>
          )}
        </dl>
      )}

      <PatientSearch />

      <section aria-labelledby="visit-list" className="space-y-4">
        <SectionHeading id="visit-list" title="Visits" description="Newest first. Filters apply to the selected period." />
        <div className="grid gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
          <SelectField id="visit-department" label="Department" value={filters.departmentId} onChange={(event) => setFilter('departmentId', event.target.value)} placeholder="All departments" options={reference.departmentOptions} />
          <SelectField id="visit-ward" label="Ward" value={filters.wardId} onChange={(event) => setFilter('wardId', event.target.value)} placeholder="All wards" options={reference.wardOptions} />
          <SelectField
            id="visit-doctor"
            label="Doctor"
            hint={adminService.capabilities.doctorAttribution ? undefined : 'Not recorded in demo mode'}
            value={filters.doctorId}
            onChange={(event) => setFilter('doctorId', event.target.value)}
            placeholder="All doctors"
            options={(doctors.data?.items ?? []).map((doctor) => ({ value: doctor.id, label: doctor.name }))}
          />
          <SelectField id="visit-status" label="Visit status" value={filters.status} onChange={(event) => setFilter('status', event.target.value)} placeholder="All statuses" options={VISIT_STATUS_OPTIONS} />
        </div>
        {(reference.status === 'error' || doctors.status === 'error') && (
          <ErrorState error={reference.error ?? doctors.error} title="Some filter options could not be loaded" onRetry={() => { reference.reload(); doctors.reload(); }} />
        )}
        {list}
      </section>
    </div>
  );
}

// ---- Visit detail ------------------------------------------------------------------------------

export function VisitDetailPage() {
  const { visitId } = useParams();
  useDocumentTitle('Visit');
  const reference = useReferenceData();
  const load = useCallback((signal) => adminService.getVisit(visitId, { signal }), [visitId]);
  const visit = useAsyncData(load);
  const loadActivity = useCallback((signal) => adminService.listAdminActions({ targetType: 'visit', targetId: visitId, limit: 10, signal }), [visitId]);
  const activity = useAsyncData(loadActivity);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  if (visit.status === 'error') {
    return (
      <div className="space-y-6">
        <Link to={PATHS.adminVisits} className={textLink}>Back to visits</Link>
        <ErrorState error={visit.error} onRetry={visit.reload} />
      </div>
    );
  }
  if (!visit.data) return <LoadingState label="Loading visit…" />;
  const item = visit.data;

  return (
    <div className="space-y-6">
      <Link to={PATHS.adminVisits} className={`${textLink} inline-flex min-h-11 items-center`}>Back to visits</Link>
      <PageHeader eyebrow="Visit" title={formatServiceDate(item.serviceDate)} description={VISIT_DEFINITION} actions={<Badge kind={item.status} />} />
      {saved && <SuccessMessage title="Visit details saved." />}

      <section aria-labelledby="visit-details" className="space-y-4 rounded-xl border border-line bg-white p-5 sm:p-6">
        <SectionHeading id="visit-details" title="Details" />
        <DetailList
          items={[
            ['Patient', item.patient.id && item.patient.identifier
              ? <Link to={adminPatientPath(item.patient.id)} className={textLink}>{item.patient.name}</Link>
              : item.patient.name],
            ['Username', item.patient.identifier],
            ['Departments', item.departments.map((department) => department.name ?? department.id).join(', ')],
            ['Ward', item.ward?.name],
            ['First token', formatDateTime(item.firstTokenAt)],
            ['Administrative note', item.adminNote],
          ]}
        />
      </section>

      <section aria-labelledby="visit-tokens" className="space-y-3">
        <SectionHeading id="visit-tokens" title="Queue tokens in this visit" description="Each token is one department queue. Consultation status comes from the token." />
        <ul className="space-y-3">
          {item.tokens.map((token) => (
            <li key={token.id} className="rounded-xl border border-line bg-white p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xl font-bold text-slate-900">{token.displayNumber}</span>
                <StatusBadge status={token.status} />
                <span className="text-slate-700">{token.department.name ?? token.department.id}</span>
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div><dt className="text-slate-600">Issued</dt><dd>{formatDateTime(token.issuedAt)}</dd></div>
                <div><dt className="text-slate-600">Called</dt><dd>{formatDateTime(token.calledAt)}</dd></div>
                <div><dt className="text-slate-600">Completed</dt><dd>{formatDateTime(token.completedAt)}</dd></div>
                <div>
                  <dt className="text-slate-600">Consultation started by</dt>
                  <dd>
                    {token.consultedBy
                      ? (token.consultedBy.role === 'staff'
                        ? <Link to={adminStaffPath(token.consultedBy.staffType, token.consultedBy.id)} className={textLink}>{token.consultedBy.name}</Link>
                        : `${token.consultedBy.name} (${token.consultedBy.role})`)
                      : adminService.capabilities.doctorAttribution ? 'Not recorded' : 'Not recorded in demo mode'}
                  </dd>
                </div>
              </dl>
              {token.statusHistory.length > 0 && (
                <details className="mt-2 text-sm">
                  <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand-800">Status history ({token.statusHistory.length})</summary>
                  <ol className="mt-1 space-y-1 pl-1">
                    {token.statusHistory.map((change, index) => (
                      <li key={index}>
                        {formatDateTime(change.occurredAt)}: {change.fromStatus.replace('_', ' ')} → {change.toStatus.replace('_', ' ')} by {change.actor?.name ?? 'unknown'} ({change.actor?.role ?? '—'})
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="visit-correct" className="space-y-4 rounded-xl border border-line bg-white p-5 sm:p-6">
        <SectionHeading
          id="visit-correct"
          title="Correct visit details"
          description="Only the ward and an administrative note can be corrected. Tokens, statuses, and dates come from the queue and cannot be edited."
          actions={!editing && <Button variant="secondary" onClick={() => { setEditing(true); setSaved(false); }}>Correct details</Button>}
        />
        {editing && (
          <VisitCorrectionForm
            visit={item}
            reference={reference}
            onCancel={() => setEditing(false)}
            onSaved={(updated) => { visit.setData(updated); setEditing(false); setSaved(true); activity.reload(); }}
          />
        )}
      </section>

      <section aria-labelledby="visit-history" className="space-y-3">
        <SectionHeading id="visit-history" title="Correction history" />
        {activity.status === 'error' ? <ErrorState error={activity.error} onRetry={activity.reload} />
          : !activity.data ? <LoadingState label="Loading history…" />
            : activity.data.items.length === 0 ? <p className="text-sm text-slate-700">No corrections recorded.</p>
              : <AuditEntryList entries={activity.data.items} names={reference.names} showTarget={false} />}
      </section>
    </div>
  );
}

function VisitCorrectionForm({ visit, reference, onCancel, onSaved }) {
  const [wardId, setWardId] = useState(visit.ward?.id ?? '');
  const [note, setNote] = useState(visit.adminNote ?? '');
  const [confirming, setConfirming] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [noteError, setNoteError] = useState(null);

  const wardOptions = visit.ward && !reference.activeWardOptions.some((option) => option.value === visit.ward.id)
    ? [...reference.activeWardOptions, { value: visit.ward.id, label: `${visit.ward.name ?? visit.ward.id} (inactive)` }]
    : reference.activeWardOptions;

  function review(event) {
    event.preventDefault();
    if (note.trim().length > 500) {
      setNoteError('Use 500 characters or fewer.');
      return;
    }
    const changes = {};
    if ((wardId || null) !== (visit.ward?.id ?? null)) changes.wardId = wardId || null;
    if ((note.trim() || null) !== (visit.adminNote ?? null)) changes.adminNote = note.trim() || null;
    if (Object.keys(changes).length === 0) {
      setError({ message: 'Nothing has changed.', code: 'NO_CHANGES' });
      return;
    }
    setError(null);
    setConfirming(changes);
  }

  async function save() {
    setPending(true);
    try {
      onSaved(await adminService.correctVisit(visit.id, confirming));
    } catch (caught) {
      setError(caught);
      setConfirming(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <form noValidate onSubmit={review} className="space-y-4">
      {error?.code === 'NO_CHANGES' ? <p role="status" className="text-sm text-slate-800">Nothing has changed.</p> : error && <ErrorState error={error} />}
      <SelectField id="visit-ward-correction" label="Ward" value={wardId} onChange={(event) => setWardId(event.target.value)} placeholder="No ward" options={wardOptions} />
      <TextAreaField
        id="visit-note"
        label="Administrative note"
        hint="For administrative corrections only. Do not record clinical or medical information. Up to 500 characters."
        maxLength={500}
        value={note}
        error={noteError}
        onChange={(event) => { setNote(event.target.value); setNoteError(null); }}
      />
      {confirming ? (
        <ConfirmPrompt title="Save these corrections?" confirmLabel="Save corrections" pendingLabel="Saving…" pending={pending} onConfirm={save} onCancel={() => setConfirming(null)}>
          The change is recorded in the audit history. The note text itself is not copied into the audit record.
        </ConfirmPrompt>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button type="submit">Review changes</Button>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        </div>
      )}
    </form>
  );
}

// ---- Patient detail ----------------------------------------------------------------------------

export function PatientDetailPage() {
  const { patientId } = useParams();
  const [page, setPage] = usePageParam();
  const load = useCallback((signal) => adminService.getPatient(patientId, { signal }), [patientId]);
  const patient = useAsyncData(load);
  const loadVisits = useCallback(
    (signal) => adminService.listVisits({ period: ALL_TIME, patientId, page, limit: PAGE_SIZE, signal }),
    [patientId, page],
  );
  const visits = useAsyncData(loadVisits);
  useDocumentTitle(patient.data?.name ?? 'Patient');

  if (patient.status === 'error') {
    return (
      <div className="space-y-6">
        <Link to={PATHS.adminVisits} className={textLink}>Back to patients & visits</Link>
        <ErrorState error={patient.error} onRetry={patient.reload} />
      </div>
    );
  }
  if (!patient.data) return <LoadingState label="Loading patient…" />;
  const item = patient.data;
  const summary = item.visitSummary;

  return (
    <div className="space-y-6">
      <Link to={PATHS.adminVisits} className={`${textLink} inline-flex min-h-11 items-center`}>Back to patients & visits</Link>
      <PageHeader
        eyebrow="Patient"
        title={item.name}
        description="Registration details and visit history. The app holds no medical records."
      />
      <section aria-labelledby="patient-details" className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <h2 id="patient-details" className="sr-only">Registration details</h2>
        <DetailList items={[
          ['Username', item.identifier],
          ['Registered', formatDateTime(item.registeredAt)],
          ['Preferred language', item.preferredLanguage === 'hi' ? 'Hindi' : item.preferredLanguage === 'en' ? 'English' : null],
          ['Account', item.isActive ? 'Active' : 'Deactivated'],
        ]} />
      </section>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Visits" value={summary.totalVisits} period={summary.firstVisitDate ? `${formatServiceDate(summary.firstVisitDate)} – ${formatServiceDate(summary.lastVisitDate)}` : 'No visits yet'} />
        <StatCard label="Queue tokens" value={summary.tokensIssued} period="All time" />
        <StatCard label="Consultations completed" value={summary.consultationsCompleted} period="All time" />
        <StatCard label="Active tokens" value={summary.activeTokens} period="Now" />
      </dl>

      {summary.departments.length > 0 && (
        <section aria-labelledby="patient-departments" className="space-y-2">
          <h2 id="patient-departments" className="text-lg font-bold text-slate-900">Departments visited</h2>
          <ul className="flex flex-wrap gap-2">
            {summary.departments.map((department) => (
              <li key={department.id} className="rounded-lg border border-line bg-white px-3 py-2 text-sm">
                {department.name ?? department.id}: <strong className="tabular-nums">{formatCount(department.departmentVisits)}</strong> {department.departmentVisits === 1 ? 'visit' : 'visits'}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="patient-visits" className="space-y-3">
        <SectionHeading id="patient-visits" title="Visit history" description="All visits, newest first." />
        {visits.status === 'error' ? <ErrorState error={visits.error} onRetry={visits.reload} />
          : !visits.data ? <LoadingState label="Loading visits…" />
            : visits.data.items.length === 0 ? <Notice tone="info" title="No visits yet">This patient has not received a queue token.</Notice>
              : (
                <div className="space-y-4">
                  <VisitTable items={visits.data.items} showPatient={false} />
                  <Pagination meta={visits.data.meta} onPage={setPage} label="visits" />
                </div>
              )}
      </section>
    </div>
  );
}
