import { useCallback, useMemo } from 'react';
import { Download, Printer } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Container } from '../components/common/Container';
import { ErrorState } from '../components/feedback/ErrorState';
import { LoadingState } from '../components/feedback/LoadingState';
import { Notice } from '../components/feedback/Notice';
import { PageHeader } from '../components/layout/PageHeader';
import { departmentService } from '../features/departments/departmentService';
import { loadFloorMaps } from '../features/navigation/locationLookup';
import { QrCodeSvg } from '../features/qr/QrCodeSvg';
import { buildQrUrl, parseQrPayload, publicAppOrigin } from '../features/qr/qrPayload';
import { useAsyncData } from '../hooks/useAsyncData';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useTranslation } from '../hooks/useTranslation';
import { downloadQrSvg } from '../features/qr/downloadQrSvg';
import { encodeQr } from '../lib/qrcode';

const LOCAL_HOSTS = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/;

function downloadSvg(entry) {
  downloadQrSvg(entry.qr, { title: entry.label, fileName: entry.fileName });
}

/**
 * Demo QR codes for the configured hospital data. Codes are generated in the browser (no QR
 * service) from URLs built by the app and re-validated with the same parser the scanner uses.
 */
export function QrCodesPage() {
  const { t } = useTranslation();
  const { isMockAuth } = useAuth();
  useDocumentTitle(t('qr.title'));

  const origin = publicAppOrigin() ?? window.location.origin;
  const isLocal = LOCAL_HOSTS.test(new URL(origin).hostname);

  const load = useCallback(async (signal) => {
    const [departments, { maps, failedFloors }] = await Promise.all([
      departmentService.listDepartments({ signal }),
      loadFloorMaps(signal),
    ]);
    return { departments, maps, failedFloors };
  }, []);
  const data = useAsyncData(load);

  const groups = useMemo(() => {
    if (!data.data) return [];
    const make = (payload, label, detail) => {
      const url = buildQrUrl(payload, origin);
      if (!parseQrPayload(url).ok) return null; // never render a code the scanner would reject
      try {
        return { key: `${payload.type}:${payload.id ?? ''}`, payload, label, detail, url, qr: encodeQr(url), fileName: `sehat-darshak-${payload.type}${payload.id ? `-${payload.id}` : ''}.svg` };
      } catch {
        return null;
      }
    };
    return [
      { key: 'hospital', title: t('qr.groups.hospital'), entries: [make({ type: 'hospital' }, t('scan.types.hospital'))] },
      {
        key: 'departments',
        title: t('qr.groups.departments'),
        entries: data.data.departments.map((d) => make({ type: 'department', id: d.id }, d.name, t('scan.types.department'))),
      },
      {
        key: 'queues',
        title: t('qr.groups.queues'),
        entries: data.data.departments.map((d) => make({ type: 'queue', id: d.id }, d.name, t('scan.types.queue'))),
      },
      {
        key: 'locations',
        title: t('qr.groups.locations'),
        entries: data.data.maps.flatMap((map) =>
          (map.locations ?? []).map((l) => make({ type: 'location', id: l.id }, l.displayName, map.displayName)),
        ),
      },
    ].map((group) => ({ ...group, entries: group.entries.filter(Boolean) }));
  }, [data.data, origin, t]);

  let content;
  if (data.status === 'error') content = <ErrorState error={data.error} onRetry={data.reload} />;
  else if (!data.data) content = <LoadingState label={t('qr.loading')} />;
  else {
    content = (
      <div className="space-y-10">
        {data.data.failedFloors > 0 && <Notice tone="warning" title={t('waiting.someFloorsFailed')} />}
        {groups.map((group) => (
          <section key={group.key} aria-labelledby={`qr-group-${group.key}`} className="space-y-4">
            <h2 id={`qr-group-${group.key}`} className="text-xl font-bold text-slate-900">
              {group.title}
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.entries.map((entry) => (
                <li key={entry.key} className="flex flex-col rounded-xl border border-line bg-white p-4 break-inside-avoid">
                  <p className="font-semibold text-slate-900">{entry.label}</p>
                  {entry.detail && <p className="text-sm text-slate-600">{entry.detail}</p>}
                  {isMockAuth && (
                    <p className="mt-1 self-start rounded border border-amber-300 bg-amber-50 px-1.5 text-xs font-semibold text-amber-950">
                      {t('qr.demoBadge')}
                    </p>
                  )}
                  <QrCodeSvg qr={entry.qr} label={t('qr.qrAlt', { label: entry.label })} className="mx-auto my-3 w-full max-w-[12rem]" />
                  <p className="text-xs break-all text-slate-600">
                    <span className="sr-only">{t('qr.link')}: </span>
                    <code>{entry.url}</code>
                  </p>
                  <Button variant="secondary" className="mt-3 print:hidden" onClick={() => downloadSvg(entry)}>
                    <Download aria-hidden="true" className="size-4" />
                    {t('qr.download')}
                    <span className="sr-only"> — {entry.label}</span>
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <PageHeader
        eyebrow={t('scan.eyebrow')}
        title={t('qr.title')}
        description={t('qr.intro')}
        actions={
          <Button variant="secondary" onClick={() => window.print()} className="print:hidden">
            <Printer aria-hidden="true" className="size-5" />
            {t('qr.print')}
          </Button>
        }
      />
      <div className="space-y-3 print:hidden">
        {isMockAuth && (
          <Notice tone="warning" title={t('qr.demoBadge')}>
            {t('qr.demoNotice')}
          </Notice>
        )}
        {isLocal ? (
          <Notice tone="warning" title={t('qr.localWarningTitle')}>
            {t('qr.localWarningBody', { origin })}
          </Notice>
        ) : (
          <Notice tone="info" title={t('qr.publicTitle')}>
            {t('qr.publicBody', { origin })}
          </Notice>
        )}
        <Notice tone="info" title={t('qr.howToTestTitle')}>
          {t('qr.howToTestBody')}
        </Notice>
      </div>
      {content}
    </Container>
  );
}
