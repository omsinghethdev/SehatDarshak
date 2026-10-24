import { useCallback } from 'react';
import { Building2 } from 'lucide-react';
import { Container } from '../components/common/Container';
import { EmptyState } from '../components/feedback/EmptyState';
import { ErrorState } from '../components/feedback/ErrorState';
import { LoadingState } from '../components/feedback/LoadingState';
import { Notice } from '../components/feedback/Notice';
import { SelectField } from '../components/forms/SelectField';
import { departmentService } from '../features/departments/departmentService';
import { StaffQueueBoard } from '../features/staff/StaffQueueBoard';
import { useDepartmentSelection } from '../features/staff/useDepartmentSelection';
import { useAsyncData } from '../hooks/useAsyncData';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function StaffQueuePage() {
  useDocumentTitle('Queue management');
  const { isMockAuth, role } = useAuth();

  const loadDepartments = useCallback((signal) => departmentService.listDepartments({ signal }), []);
  const departments = useAsyncData(loadDepartments);
  const [departmentId, selectDepartment] = useDepartmentSelection(departments.data);
  const department = departments.data?.find((item) => item.id === departmentId);

  let content;
  if (departments.status === 'error') {
    content = <ErrorState error={departments.error} onRetry={departments.reload} />;
  } else if (!departments.data) {
    content = <LoadingState label="Loading departments…" />;
  } else if (!department) {
    content = <EmptyState icon={Building2} title="No departments are available" description="There is no queue to manage right now." />;
  } else {
    content = (
      <div className="space-y-6">
        <SelectField
          id="staff-department"
          label="Department"
          hint={
            role === 'admin'
              ? 'Administrators can monitor and manage every department.'
              : 'You can manage only the department you are assigned to.'
          }
          options={departments.data.map((item) => ({ value: item.id, label: `${item.name} (${item.code})` }))}
          value={department.id}
          onChange={(event) => selectDepartment(event.target.value)}
          className="max-w-md"
        />
        <section aria-labelledby="queue-heading" className="space-y-4">
          <h2 id="queue-heading" className="text-2xl font-bold tracking-tight text-slate-900">
            {department.name} queue
          </h2>
          <StaffQueueBoard key={department.id} department={department} />
        </section>
      </div>
    );
  }

  return (
    <Container className="max-w-4xl space-y-8 py-10 sm:py-14">
      <div>
        <p className="text-sm font-semibold tracking-wide text-brand-700 uppercase">Staff tools</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Queue management</h1>
        <p className="mt-2 max-w-2xl text-slate-700">
          Call the next patient and update consultation status. Patients see these changes on their
          token page.
        </p>
      </div>

      {isMockAuth && (
        <Notice tone="warning" title="Simulated queue">
          These tokens are fictional demo data stored in this browser. Actions here change the demo
          only — they do not affect a real hospital queue or notify anyone.
        </Notice>
      )}

      {content}
    </Container>
  );
}
