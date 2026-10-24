import { useCallback } from 'react';
import { Building2, HandHelping, Map as MapIcon, MapPin, QrCode, Ticket } from 'lucide-react';
import { Link } from 'react-router';
import { ButtonLink } from '../../components/common/Button';
import { QuickActionCard } from '../../components/common/QuickActionCard';
import { ErrorState } from '../../components/feedback/ErrorState';
import { LoadingState } from '../../components/feedback/LoadingState';
import { Notice } from '../../components/feedback/Notice';
import { PageHeader } from '../../components/layout/PageHeader';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { PATHS, bookTokenPath, mapLocationPath, tokenStatusPath } from '../../routes/paths';
import { getLocationType, typeLabel } from '../navigation/locationTypes';
import { queueService } from '../queue/queueService';
import { resolveQrDestination } from './resolveQrDestination';

/** Queue action for a department: patients book (or open their existing token); others see why not. */
function QueueAction({ department, activeTokens, primary }) {
  const { t } = useTranslation();
  const { role } = useAuth();
  if (role !== 'patient') return <p className="text-sm text-slate-700">{t('scan.queuePatientsOnly')}</p>;
  const existing = activeTokens?.find((token) => token.departmentId === department.id);
  return existing ? (
    <ButtonLink to={tokenStatusPath(existing.id)} variant={primary ? 'primary' : 'secondary'}>
      <Ticket aria-hidden="true" className="size-5" />
      {t('scan.viewYourToken', { number: existing.displayNumber })}
    </ButtonLink>
  ) : (
    <ButtonLink to={bookTokenPath(department.id)} variant={primary ? 'primary' : 'secondary'}>
      <Ticket aria-hidden="true" className="size-5" />
      {t('scan.bookToken')}
    </ButtonLink>
  );
}

function RoomList({ map }) {
  const { t } = useTranslation();
  if (map.error) return <p className="text-slate-700">{t('scan.mapUnavailable')}</p>;
  if (map.locations.length === 0) return <p className="text-slate-700">{t('scan.noRooms')}</p>;
  return (
    <ul className="space-y-2">
      {map.locations.map((location) => (
        <li key={location.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-white p-3">
          <span>
            <span className="block font-semibold text-slate-900">{location.displayName}</span>
            <span className="block text-sm text-slate-600">
              {typeLabel(getLocationType(location.roomType), t)} · {location.floorName}
            </span>
          </span>
          <ButtonLink to={mapLocationPath(location.floorId, location.id)} variant="secondary">
            <MapPin aria-hidden="true" className="size-4" />
            {t('scan.findOnMap')}
            <span className="sr-only"> — {location.displayName}</span>
          </ButtonLink>
        </li>
      ))}
    </ul>
  );
}

/**
 * The destination behind a validated QR payload, loaded from the existing services. Actions only
 * link to existing routes, which keep their own sign-in and role checks.
 */
export function ScanResult({ type, id }) {
  const { t } = useTranslation();
  const { role, isMockAuth } = useAuth();

  const load = useCallback((signal) => resolveQrDestination({ type, id }, signal), [type, id]);
  const destination = useAsyncData(load);
  const loadTokens = useCallback(
    (signal) => (role === 'patient' && type !== 'hospital' ? queueService.listActiveTokens({ signal }) : Promise.resolve([])),
    [role, type],
  );
  const tokens = useAsyncData(loadTokens);

  const scanAgain = (
    <Link to={PATHS.scan} className="inline-flex min-h-11 items-center gap-2 font-semibold text-brand-800 underline underline-offset-4">
      <QrCode aria-hidden="true" className="size-5" />
      {t('scan.scanAgain')}
    </Link>
  );

  if (destination.status === 'error') {
    const code = destination.error?.code;
    if (code === 'UNKNOWN_DESTINATION') {
      return (
        <div className="space-y-6">
          <Notice tone="error" role="alert" title={t('scan.unknownTitle')}>
            {t('scan.unknownBody')}
          </Notice>
          {scanAgain}
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <ErrorState
          error={destination.error}
          title={code === 'MAP_INCOMPLETE' ? t('scan.mapIncompleteTitle') : undefined}
          description={code === 'MAP_INCOMPLETE' ? t('scan.mapUnavailable') : undefined}
          onRetry={destination.reload}
        />
        {scanAgain}
      </div>
    );
  }
  if (!destination.data) return <LoadingState label={t('scan.loadingDestination')} />;

  const data = destination.data;
  const demoNotice = isMockAuth && (
    <Notice tone="warning" title={t('scan.demoTitle')}>
      {t('scan.demoBody')}
    </Notice>
  );

  if (data.type === 'hospital') {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow={t('scan.resultEyebrow')} title={t('scan.hospitalTitle')} description={t('scan.hospitalBody')} />
        {demoNotice}
        <ul className="grid gap-3 sm:grid-cols-2">
          <li>
            <QuickActionCard to={PATHS.navigation} icon={MapIcon} title={t('nav.map')} description={t('dashboard.actions.map')} />
          </li>
          <li>
            <QuickActionCard to={PATHS.departments} icon={Building2} title={t('dashboard.actions.infoTitle')} description={t('dashboard.actions.info')} />
          </li>
          {role === 'patient' && (
            <>
              <li>
                <QuickActionCard to={PATHS.bookToken} icon={Ticket} title={t('nav.bookToken')} description={t('dashboard.actions.book')} />
              </li>
              <li>
                <QuickActionCard to={PATHS.assistance} icon={HandHelping} title={t('assistance.requestAction')} description={t('dashboard.actions.help')} />
              </li>
            </>
          )}
        </ul>
        {scanAgain}
      </div>
    );
  }

  if (data.type === 'location') {
    const { location, floor, department } = data;
    return (
      <div className="space-y-8">
        <PageHeader eyebrow={t('scan.resultEyebrow')} title={location.displayName} description={t('scan.types.location')} />
        {demoNotice}
        <dl className="grid gap-4 rounded-xl border border-line bg-white p-5 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-slate-600">{t('map.type')}</dt>
            <dd className="font-medium text-slate-900">{typeLabel(getLocationType(location.roomType), t)}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-600">{t('map.floor')}</dt>
            <dd className="font-medium text-slate-900">{floor.displayName}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-600">{t('queue.department')}</dt>
            <dd className="font-medium text-slate-900">
              {location.departmentId ? department?.name ?? t('queue.departmentUnavailable') : t('map.noDepartment')}
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap items-start gap-3">
          <ButtonLink to={mapLocationPath(floor.id, location.id)}>
            <MapPin aria-hidden="true" className="size-5" />
            {t('scan.findOnMap')}
          </ButtonLink>
          {department && <QueueAction department={department} activeTokens={tokens.data} />}
        </div>
        <p className="text-sm text-slate-600">{t('map.noDirections')}</p>
        {scanAgain}
      </div>
    );
  }

  // department or queue
  const { department, map } = data;
  const isQueue = data.type === 'queue';
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t('scan.resultEyebrow')}
        title={department.name}
        description={`${t(isQueue ? 'scan.types.queue' : 'scan.types.department')} · ${department.code}`}
      />
      {demoNotice}
      {department.description && <p className="text-lg text-slate-700">{department.description}</p>}
      <section aria-labelledby="scan-queue-heading" className="space-y-3 rounded-xl border border-line bg-white p-5">
        <h2 id="scan-queue-heading" className="text-lg font-bold text-slate-900">
          {t('scan.queueHeading')}
        </h2>
        <QueueAction department={department} activeTokens={tokens.data} primary={isQueue} />
      </section>
      <section aria-labelledby="scan-rooms-heading" className="space-y-3">
        <h2 id="scan-rooms-heading" className="text-lg font-bold text-slate-900">
          {t('scan.rooms')}
        </h2>
        <RoomList map={map} />
        <p className="text-sm text-slate-600">{t('map.noDirections')}</p>
      </section>
      {scanAgain}
    </div>
  );
}
