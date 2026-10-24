import { useCallback } from 'react';
import { Building2, HandHelping, History, ListOrdered, Map as MapIcon, Ticket } from 'lucide-react';
import { Button, ButtonLink } from '../../components/common/Button';
import { QuickActionCard } from '../../components/common/QuickActionCard';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ErrorState } from '../../components/feedback/ErrorState';
import { LoadingState } from '../../components/feedback/LoadingState';
import { Notice } from '../../components/feedback/Notice';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { PATHS, tokenStatusPath } from '../../routes/paths';
import { departmentService } from '../departments/departmentService';
import { StatusLegend } from '../queue/StatusLegend';
import { TokenCard } from '../queue/TokenCard';
import { queueService } from '../queue/queueService';

function ActiveTokens({ status, data, error, reload }) {
  const { t } = useTranslation();
  if (status === 'error') return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <LoadingState label={t('dashboard.loadingTokens')} />;

  if (data.tokens.length === 0) {
    return (
      <EmptyState
        icon={Ticket}
        title={t('dashboard.noToken')}
        description={t('dashboard.noTokenBody')}
        action={
          <ButtonLink to={PATHS.bookToken}>
            <Ticket aria-hidden="true" className="size-5" />
            {t('nav.bookToken')}
          </ButtonLink>
        }
      />
    );
  }

  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {data.tokens.map((token) => (
        <li key={token.id}>
          <TokenCard token={token} department={data.departmentsById.get(token.departmentId)} className="h-full" />
        </li>
      ))}
    </ul>
  );
}

/** Patient view of /dashboard: active tokens and quick actions. */
export function PatientDashboard() {
  const { isMockAuth } = useAuth();
  const { t } = useTranslation();

  const load = useCallback(async (signal) => {
    const [tokens, departments] = await Promise.all([
      queueService.listActiveTokens({ signal }),
      departmentService.listDepartments({ signal }),
    ]);
    return { tokens, departmentsById: new Map(departments.map((department) => [department.id, department])) };
  }, []);
  const tokensState = useAsyncData(load);
  const tokens = tokensState.data?.tokens;

  let statusAction;
  if (!tokens) {
    statusAction = { description: t('dashboard.checkingTokens') };
  } else if (tokens.length === 0) {
    statusAction = { description: t('dashboard.noTokenYet') };
  } else if (tokens.length === 1) {
    statusAction = {
      to: tokenStatusPath(tokens[0].id),
      description: t('dashboard.followToken', { number: tokens[0].displayNumber }),
    };
  } else {
    statusAction = { to: `${PATHS.dashboard}#active-tokens`, description: t('dashboard.activeTokenCount', { count: tokens.length }) };
  }

  return (
    <div className="space-y-10">
      {isMockAuth && (
        <Notice tone="warning" title={t('demo.dataTitle')}>
          {t('demo.dashboardBody')}
        </Notice>
      )}

      <section id="active-tokens" tabIndex={-1} aria-labelledby="tokens-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="tokens-heading" className="text-2xl font-bold tracking-tight text-slate-900">
              {t('dashboard.activeTokens')}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{t('dashboard.tokenExplained')}</p>
          </div>
          {tokens?.length > 0 && (
            <Button variant="ghost" onClick={tokensState.reload}>
              {t('common.refresh')}
            </Button>
          )}
        </div>
        <ActiveTokens {...tokensState} />
      </section>

      <section aria-labelledby="actions-heading">
        <h2 id="actions-heading" className="text-xl font-bold tracking-tight text-slate-900">
          {t('dashboard.whatToDo')}
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          <li>
            <QuickActionCard
              to={PATHS.bookToken}
              icon={Ticket}
              title={t('nav.bookToken')}
              description={t('dashboard.actions.book')}
            />
          </li>
          <li>
            <QuickActionCard to={statusAction.to} icon={ListOrdered} title={t('queue.viewStatus')} description={statusAction.description} />
          </li>
          <li>
            <QuickActionCard
              to={PATHS.tokenHistory}
              icon={History}
              title={t('queue.history.title')}
              description={t('dashboard.actions.history')}
            />
          </li>
          <li>
            <QuickActionCard
              to={PATHS.departments}
              icon={Building2}
              title={t('dashboard.actions.infoTitle')}
              description={t('dashboard.actions.info')}
            />
          </li>
          <li>
            <QuickActionCard
              to={PATHS.navigation}
              icon={MapIcon}
              title={t('nav.map')}
              description={t('dashboard.actions.map')}
            />
          </li>
          <li>
            <QuickActionCard
              to={PATHS.assistance}
              icon={HandHelping}
              title={t('assistance.requestAction')}
              description={t('dashboard.actions.help')}
            />
          </li>
        </ul>
      </section>

      <StatusLegend />
    </div>
  );
}
