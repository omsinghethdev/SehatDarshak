import { useCallback } from 'react';
import { Building2, Map as MapIcon, Ticket } from 'lucide-react';
import { Button, ButtonLink } from '../components/common/Button';
import { Container } from '../components/common/Container';
import { EmptyState } from '../components/feedback/EmptyState';
import { ErrorState } from '../components/feedback/ErrorState';
import { LoadingState } from '../components/feedback/LoadingState';
import { Notice } from '../components/feedback/Notice';
import { PageHeader } from '../components/layout/PageHeader';
import { DepartmentMapAction } from '../features/departments/DepartmentMapAction';
import { departmentService } from '../features/departments/departmentService';
import { loadDepartmentLocations } from '../features/navigation/locationLookup';
import { useAsyncData } from '../hooks/useAsyncData';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useTranslation } from '../hooks/useTranslation';
import { PATHS, bookTokenPath } from '../routes/paths';

/** Read-only hospital information: the list of OPD departments. */
export function DepartmentsPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('departments.title'));
  const { role, isMockAuth } = useAuth();

  const load = useCallback((signal) => departmentService.listDepartments({ signal }), []);
  const { status, data: departments, error, reload } = useAsyncData(load);
  // Map locations are extra help: loaded alongside, and a failure never hides the departments.
  const locations = useAsyncData(loadDepartmentLocations);

  let content;
  if (status === 'error') {
    content = <ErrorState error={error} onRetry={reload} />;
  } else if (!departments) {
    content = <LoadingState label={t('departments.loading')} />;
  } else if (departments.length === 0) {
    content = (
      <EmptyState
        icon={Building2}
        title={t('departments.emptyTitle')}
        description={t('departments.emptyBody')}
        action={<Button variant="secondary" onClick={reload}>{t('common.checkAgain')}</Button>}
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
            <div className="mt-auto flex flex-col gap-4 pt-5">
              <DepartmentMapAction department={department} lookup={locations} />
              {role === 'patient' && (
                <div>
                  <ButtonLink to={bookTokenPath(department.id)} variant="secondary">
                    <Ticket aria-hidden="true" className="size-4" />
                    {t('nav.bookToken')}
                    <span className="sr-only"> — {department.name}</span>
                  </ButtonLink>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <PageHeader
        eyebrow={t('dashboard.actions.infoTitle')}
        title={t('departments.title')}
        description={t('departments.intro')}
      />

      {isMockAuth && (
        <Notice tone="warning" title={t('demo.dataTitle')}>
          {t('demo.departmentsBody')}
        </Notice>
      )}

      {content}

      <Notice
        tone="info"
        title={t('departments.lookingTitle')}
        action={
          <ButtonLink to={PATHS.navigation} variant="secondary">
            <MapIcon aria-hidden="true" className="size-4" />
            {t('departments.openMap')}
          </ButtonLink>
        }
      >
        {t('departments.lookingBody')}
      </Notice>
    </Container>
  );
}
