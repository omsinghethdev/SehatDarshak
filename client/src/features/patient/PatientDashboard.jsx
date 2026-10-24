import { useCallback } from 'react';
import { ArrowRight, Building2, ListOrdered, Map as MapIcon, Ticket } from 'lucide-react';
import { Link } from 'react-router';
import { Button, ButtonLink } from '../../components/common/Button';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ErrorState } from '../../components/feedback/ErrorState';
import { LoadingState } from '../../components/feedback/LoadingState';
import { Notice } from '../../components/feedback/Notice';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useAuth } from '../../hooks/useAuth';
import { PATHS, tokenStatusPath } from '../../routes/paths';
import { departmentService } from '../departments/departmentService';
import { StatusLegend } from '../queue/StatusLegend';
import { TokenCard } from '../queue/TokenCard';
import { queueService } from '../queue/queueService';

function QuickAction({ to, icon: Icon, title, description }) {
  const body = (
    <>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand-50">
        <Icon aria-hidden="true" className="size-6 text-brand-700" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1 font-semibold text-slate-900">
          {title}
          {to && <ArrowRight aria-hidden="true" className="size-4" />}
        </span>
        <span className="mt-0.5 block text-sm text-slate-700">{description}</span>
      </span>
    </>
  );

  const base = 'flex h-full gap-4 rounded-xl border border-line bg-white p-5';
  return to ? (
    <Link to={to} className={`${base} hover:border-brand-600 hover:bg-brand-50/40`}>
      {body}
    </Link>
  ) : (
    <div className={`${base} bg-canvas-muted`}>{body}</div>
  );
}

function ActiveTokens({ status, data, error, reload }) {
  if (status === 'error') return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <LoadingState label="Loading your tokens…" />;

  if (data.tokens.length === 0) {
    return (
      <EmptyState
        icon={Ticket}
        title="You have no active token"
        description="Book a token for the department you need to join its queue."
        action={
          <ButtonLink to={PATHS.bookToken}>
            <Ticket aria-hidden="true" className="size-5" />
            Book a token
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
    statusAction = { description: 'Checking your tokens…' };
  } else if (tokens.length === 0) {
    statusAction = { description: 'You have no active token yet.' };
  } else if (tokens.length === 1) {
    statusAction = {
      to: tokenStatusPath(tokens[0].id),
      description: `Follow token ${tokens[0].displayNumber}.`,
    };
  } else {
    statusAction = { to: `${PATHS.dashboard}#active-tokens`, description: `You have ${tokens.length} active tokens.` };
  }

  return (
    <div className="space-y-10">
      {isMockAuth && (
        <Notice tone="warning" title="Demo data">
          Tokens, queue positions, and waiting times on this page are simulated and stored only in
          this browser. No real hospital queue is involved.
        </Notice>
      )}

      <section aria-labelledby="actions-heading">
        <h2 id="actions-heading" className="sr-only">
          Quick actions
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <li>
            <QuickAction
              to={PATHS.bookToken}
              icon={Ticket}
              title="Book a token"
              description="Join the queue for an OPD department."
            />
          </li>
          <li>
            <QuickAction to={statusAction.to} icon={ListOrdered} title="View queue status" description={statusAction.description} />
          </li>
          <li>
            <QuickAction
              to={PATHS.departments}
              icon={Building2}
              title="Hospital information"
              description="See the OPD departments."
            />
          </li>
          <li>
            <QuickAction
              to={PATHS.navigation}
              icon={MapIcon}
              title="Hospital map"
              description="Find departments and facilities on each floor."
            />
          </li>
        </ul>
      </section>

      <section id="active-tokens" tabIndex={-1} aria-labelledby="tokens-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="tokens-heading" className="text-2xl font-bold tracking-tight text-slate-900">
              Your active tokens
            </h2>
            <p className="mt-1 text-sm text-slate-600">Waiting times are simulated estimates.</p>
          </div>
          {tokens?.length > 0 && (
            <Button variant="ghost" onClick={tokensState.reload}>
              Refresh
            </Button>
          )}
        </div>
        <ActiveTokens {...tokensState} />
      </section>

      <StatusLegend />
    </div>
  );
}
