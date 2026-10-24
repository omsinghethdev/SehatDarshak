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
import { PageHeader } from '../components/layout/PageHeader';
import { departmentService } from '../features/departments/departmentService';
import { BookTokenForm } from '../features/queue/BookTokenForm';
import { TokenCard } from '../features/queue/TokenCard';
import { queueService } from '../features/queue/queueService';
import { useAsyncData } from '../hooks/useAsyncData';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useTranslation } from '../hooks/useTranslation';
import { ListenButton } from '../components/common/ListenButton';
import { PATHS, tokenStatusPath } from '../routes/paths';

function BookingConfirmation({ token, department, onBookAnother }) {
  const headingRef = useRef(null);
  const { t, tx } = useTranslation();
  useEffect(() => headingRef.current?.focus(), []);
  const departmentName = department?.name ?? t('queue.yourDepartment');

  return (
    <div className="space-y-6">
      <SuccessMessage
        title={t('booking.bookedTitle')}
        action={<ListenButton text={() => t('booking.bookedSpeech', { department: departmentName, number: token.displayNumber })} />}
      >
        {tx('booking.bookedBody', { department: departmentName, number: <strong>{token.displayNumber}</strong> })}
      </SuccessMessage>
      <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-slate-900">
        {t('booking.newToken')}
      </h2>
      <TokenCard token={token} department={department} showStatusLink={false} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <ButtonLink to={tokenStatusPath(token.id)}>
          {t('queue.viewStatus')}
          <ArrowRight aria-hidden="true" className="size-5" />
        </ButtonLink>
        <ButtonLink to={PATHS.dashboard} variant="secondary">
          {t('common.backToDashboard')}
        </ButtonLink>
        <Button variant="ghost" onClick={onBookAnother}>
          {t('booking.bookAnother')}
        </Button>
      </div>
    </div>
  );
}

export function BookTokenPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('nav.bookToken'));
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
  const { status, data, error, reload, setData } = useAsyncData(load);

  function handleBookAnother() {
    // Show the new token as active straight away so its department is not briefly selectable
    // while the list reloads (the service would reject a second booking anyway).
    const booked = bookedToken;
    setData((current) => current && { ...current, activeTokens: [...current.activeTokens, booked] });
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
    content = <LoadingState label={t('departments.loading')} />;
  } else if (data.departments.length === 0) {
    content = (
      <EmptyState
        icon={Building2}
        title={t('booking.noDepartments')}
        description={t('booking.noDepartmentsBody')}
        action={<Button variant="secondary" onClick={reload}>{t('common.checkAgain')}</Button>}
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
      <PageHeader
        eyebrow={t('booking.eyebrow')}
        title={t('nav.bookToken')}
        description={t('booking.intro')}
      />

      {isMockAuth && (
        <Notice tone="warning" title={t('demo.dataTitle')}>
          {t('demo.bookingBody')}
        </Notice>
      )}

      {content}
    </Container>
  );
}
