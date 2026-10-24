import { useCallback } from 'react';
import { Building2 } from 'lucide-react';
import { Container } from '../components/common/Container';
import { EmptyState } from '../components/feedback/EmptyState';
import { ErrorState } from '../components/feedback/ErrorState';
import { LoadingState } from '../components/feedback/LoadingState';
import { Notice } from '../components/feedback/Notice';
import { SelectField } from '../components/forms/SelectField';
import { PageHeader } from '../components/layout/PageHeader';
import { departmentService } from '../features/departments/departmentService';
import { StaffQueueBoard } from '../features/staff/StaffQueueBoard';
import { useDepartmentSelection } from '../features/staff/useDepartmentSelection';
import { useAsyncData } from '../hooks/useAsyncData';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function StaffQueuePage() {
  useDocumentTitle('Queue management');
  const { isMockAuth, role, user } = useAuth();
  // Staff work only in the department the server assigned them (from the sign-in response);
  // administrators can choose any department.
  const isStaff = role === 'staff';

  const loadDepartments = useCallback((signal) => departmentService.listDepartments({ signal }), []);
  const departments = useAsyncData(loadDepartments);
  const [selectedId, selectDepartment] = useDepartmentSelection(isStaff ? null : departments.data);
  const departmentId = isStaff ? user?.departmentId : selectedId;
  const department = departments.data?.find((item) => item.id === departmentId);

  let content;
  if (isStaff && !departmentId) {
    content = (
      <EmptyState
        icon={Building2}
        title="You are not assigned to a department"
        description="Ask an administrator to assign you to a department, then sign out and sign in again."
      />
    );
  } else if (departments.status === 'error') {
    content = <ErrorState error={departments.error} onRetry={departments.reload} />;
  } else if (!departments.data) {
    content = <LoadingState label="Loading departments…" />;
  } else if (!department) {
    content = isStaff ? (
      <EmptyState
        icon={Building2}
        title="Your department is not available"
        description="Your assigned department is not currently open. Ask an administrator to check your assignment."
      />
    ) : (
      <EmptyState icon={Building2} title="No departments are available" description="There is no queue to manage right now." />
    );
  } else {
    content = (
      <div className="space-y-6">
        {isStaff ? (
          <p className="text-slate-700">
            Your department: <span className="font-semibold text-slate-900">{department.name} ({department.code})</span>
          </p>
        ) : (
          <SelectField
            id="staff-department"
            label="Department"
            hint="Administrators can monitor and manage every department."
            options={departments.data.map((item) => ({ value: item.id, label: `${item.name} (${item.code})` }))}
            value={department.id}
            onChange={(event) => selectDepartment(event.target.value)}
            className="max-w-md"
          />
        )}
        <section aria-labelledby="queue-heading" className="space-y-4">
          <h2 id="queue-heading" className="text-2xl font-bold tracking-tight text-slate-900">
            {department.name} queue
          </h2>
          <StaffQueueBoard key={department.id} department={department} canChooseDepartment={!isStaff} />
        </section>
      </div>
    );
  }

  return (
    <Container className="max-w-4xl space-y-8 py-10 sm:py-14">
      <PageHeader
        eyebrow="Staff tools"
        title="Queue management"
        description="Call the next patient and update consultation status. Patients see these changes on their token page."
      />

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
