import { useCallback } from 'react';
import { Building2, Map as MapIcon, Ticket } from 'lucide-react';
import { Button, ButtonLink } from '../components/common/Button';
import { Container } from '../components/common/Container';
import { EmptyState } from '../components/feedback/EmptyState';
import { ErrorState } from '../components/feedback/ErrorState';
import { LoadingState } from '../components/feedback/LoadingState';
import { Notice } from '../components/feedback/Notice';
import { PageHeader } from '../components/layout/PageHeader';
import { departmentService } from '../features/departments/departmentService';
import { useAsyncData } from '../hooks/useAsyncData';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PATHS, bookTokenPath } from '../routes/paths';

/** Read-only hospital information: the list of OPD departments. */
export function DepartmentsPage() {
  useDocumentTitle('Hospital departments');
  const { role, isMockAuth } = useAuth();

  const load = useCallback((signal) => departmentService.listDepartments({ signal }), []);
  const { status, data: departments, error, reload } = useAsyncData(load);

  let content;
  if (status === 'error') {
    content = <ErrorState error={error} onRetry={reload} />;
  } else if (!departments) {
    content = <LoadingState label="Loading departments…" />;
  } else if (departments.length === 0) {
    content = (
      <EmptyState
        icon={Building2}
        title="No departments to show"
        description="Department information is not available right now."
        action={<Button variant="secondary" onClick={reload}>Check again</Button>}
      />
    );
  } else {
    content = (
      <ul className="grid gap-4 md:grid-cols-2">
        {departments.map((department) => (
          <li key={department.id} className="flex flex-col rounded-xl border border-line bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">{department.name}</h2>
              <span className="rounded border border-line px-1.5 text-xs font-medium text-slate-600">
                {department.code}
              </span>
            </div>
            {department.description && <p className="mt-2 text-slate-700">{department.description}</p>}
            {role === 'patient' && (
              <div className="mt-auto pt-5">
                <ButtonLink to={bookTokenPath(department.id)} variant="secondary">
                  <Ticket aria-hidden="true" className="size-4" />
                  Book a token
                  <span className="sr-only"> for {department.name}</span>
                </ButtonLink>
              </div>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <PageHeader
        eyebrow="Hospital information"
        title="OPD departments"
        description="The outpatient departments you can visit."
      />

      {isMockAuth && (
        <Notice tone="warning" title="Demo data">
          These departments are fictional examples for demonstration only.
        </Notice>
      )}

      {content}

      <Notice
        tone="info"
        title="Looking for a department?"
        action={
          <ButtonLink to={PATHS.navigation} variant="secondary">
            <MapIcon aria-hidden="true" className="size-4" />
            Open the hospital map
          </ButtonLink>
        }
      >
        The hospital map shows where departments and facilities are on each floor.
      </Notice>
    </Container>
  );
}
