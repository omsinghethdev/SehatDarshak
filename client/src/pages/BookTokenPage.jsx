import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Building2 } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { Button, ButtonLink } from '../components/common/Button';
import { Container } from '../components/common/Container';
import { EmptyState } from '../components/feedback/EmptyState';
import { ErrorState } from '../components/feedback/ErrorState';
import { LoadingState } from '../components/feedback/LoadingState';
import { Notice } from '../components/feedback/Notice';
import { SuccessMessage } from '../components/feedback/SuccessMessage';
import { departmentService } from '../features/departments/departmentService';
import { BookTokenForm } from '../features/queue/BookTokenForm';
import { TokenCard } from '../features/queue/TokenCard';
import { queueService } from '../features/queue/queueService';
import { useAsyncData } from '../hooks/useAsyncData';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PATHS, tokenStatusPath } from '../routes/paths';

function BookingConfirmation({ token, department, onBookAnother }) {
  const headingRef = useRef(null);
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <div className="space-y-6">
      <SuccessMessage title="Your token has been booked">
        Your token for {department?.name ?? 'the department'} is <strong>{token.displayNumber}</strong>.
        Keep this page or your dashboard open to follow your place in the queue.
      </SuccessMessage>
      <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-slate-900">
        Your new token
      </h2>
      <TokenCard token={token} department={department} showStatusLink={false} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <ButtonLink to={tokenStatusPath(token.id)}>
          View queue status
          <ArrowRight aria-hidden="true" className="size-5" />
        </ButtonLink>
        <ButtonLink to={PATHS.dashboard} variant="secondary">
          Back to dashboard
        </ButtonLink>
        <Button variant="ghost" onClick={onBookAnother}>
          Book for another department
        </Button>
      </div>
    </div>
  );
}

export function BookTokenPage() {
  useDocumentTitle('Book a token');
  const { isMockAuth } = useAuth();
  const [searchParams] = useSearchParams();
  const [bookedToken, setBookedToken] = useState(null);

  const load = useCallback(async (signal) => {
    const [departments, activeTokens] = await Promise.all([
      departmentService.listDepartments({ signal }),
      queueService.listActiveTokens({ signal }),
    ]);
    return { departments, activeTokens };
  }, []);
  const { status, data, error, reload } = useAsyncData(load);

  function handleBookAnother() {
    setBookedToken(null);
    reload();
  }

  let content;
  if (bookedToken) {
    content = (
      <BookingConfirmation
        token={bookedToken}
        department={data?.departments.find((department) => department.id === bookedToken.departmentId)}
        onBookAnother={handleBookAnother}
      />
    );
  } else if (status === 'error') {
    content = <ErrorState error={error} onRetry={reload} />;
  } else if (!data) {
    content = <LoadingState label="Loading departments…" />;
  } else if (data.departments.length === 0) {
    content = (
      <EmptyState
        icon={Building2}
        title="No departments are available right now"
        description="Tokens cannot be booked at the moment. Please try again later or ask at the registration desk."
        action={<Button variant="secondary" onClick={reload}>Check again</Button>}
      />
    );
  } else {
    content = (
      <BookTokenForm
        departments={data.departments}
        activeTokens={data.activeTokens}
        initialDepartmentId={searchParams.get('department')}
        onBooked={setBookedToken}
        onConflict={reload}
      />
    );
  }

  return (
    <Container className="max-w-4xl space-y-8 py-10 sm:py-14">
      <div>
        <p className="text-sm font-semibold tracking-wide text-brand-700 uppercase">OPD queue</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Book a token</h1>
        <p className="mt-2 max-w-2xl text-slate-700">
          Choose the department you need. You will get a token number and can follow your place in
          the queue.
        </p>
      </div>

      {isMockAuth && (
        <Notice tone="warning" title="Demo data">
          Departments and tokens are simulated and stored only in this browser. Booking here does not
          reserve a place in a real hospital queue.
        </Notice>
      )}

      {content}
    </Container>
  );
}
