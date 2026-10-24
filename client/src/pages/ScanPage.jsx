import { useState } from 'react';
import { Camera, ImageUp, Keyboard, LogIn, QrCode, UserPlus } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ButtonLink } from '../components/common/Button';
import { Container } from '../components/common/Container';
import { Notice } from '../components/feedback/Notice';
import { PageHeader } from '../components/layout/PageHeader';
import { QrCameraScanner } from '../features/qr/QrCameraScanner';
import { QrImageUpload, QrManualEntry } from '../features/qr/QrInputs';
import { ScanResult } from '../features/qr/ScanResult';
import { buildScanPath, parseQrPayload } from '../features/qr/qrPayload';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useTranslation } from '../hooks/useTranslation';
import { PATHS } from '../routes/paths';

function Section({ icon: Icon, title, children }) {
  return (
    <section className="space-y-4 rounded-xl border border-line bg-white p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
        <Icon aria-hidden="true" className="size-5 text-brand-700" />
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Scanner screen: camera, photo, or typed link — every input goes through parseQrPayload. */
function ScannerView() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [scanError, setScanError] = useState(null);
  const [manualError, setManualError] = useState(null);

  function open(raw, source) {
    const result = parseQrPayload(raw);
    if (result.ok) {
      // Only ever navigate to a path built by the app, never to the scanned text itself.
      navigate(buildScanPath(result.payload));
      return;
    }
    if (source === 'manual') {
      setManualError(t(result.reason === 'empty' ? 'scan.manualRequired' : `scan.invalid.${result.reason}`));
    } else {
      setScanError(result.reason);
    }
  }

  return (
    <Container className="max-w-3xl space-y-6 py-10 sm:py-14">
      <PageHeader eyebrow={t('scan.eyebrow')} title={t('scan.title')} description={t('scan.intro')} />
      <Notice tone="info" title={t('scan.phoneTipTitle')}>
        {t('scan.phoneTip')}
      </Notice>

      {scanError && (
        <Notice tone="error" role="alert" title={t('scan.invalid.title')}>
          {t(`scan.invalid.${scanError}`)} {t('scan.invalid.tryAgain')}
        </Notice>
      )}

      <Section icon={Camera} title={t('scan.cameraTitle')}>
        <QrCameraScanner
          onResult={(value) => {
            setScanError(null);
            open(value, 'camera');
          }}
        />
      </Section>

      {typeof window.BarcodeDetector === 'function' && (
        <Section icon={ImageUp} title={t('scan.uploadTitle')}>
          <QrImageUpload
            onResult={(value) => {
              setScanError(null);
              open(value, 'upload');
            }}
          />
        </Section>
      )}

      <Section icon={Keyboard} title={t('scan.manualTitle')}>
        <QrManualEntry
          error={manualError}
          onSubmit={(value) => {
            setManualError(null);
            open(value, 'manual');
          }}
        />
      </Section>

      <p className="text-sm text-slate-600">{t('scan.privacy')}</p>
      {isAuthenticated && (
        <Link to={PATHS.qrCodes} className="inline-flex min-h-11 items-center gap-2 font-semibold text-brand-800 underline underline-offset-4">
          <QrCode aria-hidden="true" className="size-5" />
          {t('scan.demoCodesLink')}
        </Link>
      )}
    </Container>
  );
}

/**
 * /scan — the single entry point for every SehatDarsak QR code.
 * Without a payload it shows the scanner. With one it validates it, asks visitors to sign in
 * (returning here afterwards), and then shows the destination.
 */
export function ScanPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  useDocumentTitle(t('scan.title'));

  if (!location.search && !location.hash) return <ScannerView />;

  const parsed = parseQrPayload(`${location.pathname}${location.search}${location.hash}`);

  if (!parsed.ok) {
    return (
      <Container className="max-w-3xl space-y-6 py-10 sm:py-14">
        <PageHeader eyebrow={t('scan.eyebrow')} title={t('scan.invalid.title')} />
        <Notice tone="error" role="alert" title={t('scan.invalid.title')}>
          {t(`scan.invalid.${parsed.reason}`)}
        </Notice>
        <div className="flex flex-wrap gap-3">
          <ButtonLink to={PATHS.scan}>
            <QrCode aria-hidden="true" className="size-5" />
            {t('scan.scanAgain')}
          </ButtonLink>
          <ButtonLink to={PATHS.home} variant="secondary">
            {t('common.backHome')}
          </ButtonLink>
        </div>
      </Container>
    );
  }

  const { type, id } = parsed.payload;

  if (!isAuthenticated) {
    // Hospital data requires an account; the intended destination is kept for after sign-in.
    const returnState = { from: location };
    return (
      <Container className="max-w-3xl space-y-6 py-10 sm:py-14">
        <PageHeader eyebrow={t('scan.resultEyebrow')} title={t('scan.signInTitle')} />
        <Notice tone="info" title={t(`scan.types.${type}`)}>
          {t('scan.signInBody', { type: t(`scan.types.${type}`) })}
        </Notice>
        <div className="flex flex-wrap gap-3">
          <ButtonLink to={PATHS.login} state={returnState}>
            <LogIn aria-hidden="true" className="size-5" />
            {t('layout.signIn')}
          </ButtonLink>
          <ButtonLink to={PATHS.register} state={returnState} variant="secondary">
            <UserPlus aria-hidden="true" className="size-5" />
            {t('layout.register')}
          </ButtonLink>
        </div>
      </Container>
    );
  }

  return (
    <Container className="max-w-3xl py-10 sm:py-14">
      <ScanResult key={`${type}:${id ?? ''}`} type={type} id={id} />
    </Container>
  );
}
