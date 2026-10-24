import { useMemo } from 'react';
import { Download, QrCode } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { useTranslation } from '../../hooks/useTranslation';
import { encodeQr } from '../../lib/qrcode';
import { downloadQrSvg } from '../qr/downloadQrSvg';
import { QrCodeSvg } from '../qr/QrCodeSvg';
import { buildQrUrl, parseQrPayload, publicAppOrigin, tokenQrPayload } from '../qr/qrPayload';
import { StatusBadge } from './StatusBadge';

/**
 * QR for a queue token the service has returned, so hospital staff can look it up through /scan.
 * It encodes only `/scan?type=token&id=<tokenId>&v=1` on this app's public address — no patient
 * details or credentials — and showing or downloading it never changes the token. Renders nothing
 * if a valid code cannot be built.
 */
export function TokenQrCard({ token }) {
  const { t } = useTranslation();
  const tokenId = token?.id;

  const code = useMemo(() => {
    const payload = tokenQrPayload(tokenId);
    if (!payload) return null;
    const url = buildQrUrl(payload, publicAppOrigin() ?? window.location.origin);
    if (!parseQrPayload(url).ok) return null; // never show a code the scanner would reject
    try {
      return { url, qr: encodeQr(url) };
    } catch {
      return null;
    }
  }, [tokenId]);

  if (!code) return null;
  const label = t('queue.qr.alt', { number: token.displayNumber });

  return (
    <section aria-labelledby="token-qr-heading" className="rounded-xl border border-line bg-white p-5 sm:p-6">
      <h2 id="token-qr-heading" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
        <QrCode aria-hidden="true" className="size-5 text-brand-700" />
        {t('queue.qr.title')}
      </h2>
      <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <QrCodeSvg qr={code.qr} label={label} className="w-full max-w-[13rem] shrink-0 rounded-lg border border-line" />
        <div className="min-w-0 space-y-3 text-center sm:text-left">
          <p className="text-3xl font-bold tracking-tight text-slate-900">{token.displayNumber}</p>
          <StatusBadge status={token.status} />
          <p className="text-slate-700">{t('queue.qr.body')}</p>
          <p className="text-sm text-slate-600">{t('queue.qr.privacy')}</p>
          <Button
            variant="secondary"
            onClick={() => downloadQrSvg(code.qr, { title: label, fileName: `sehat-darshak-token-${token.displayNumber}.svg` })}
          >
            <Download aria-hidden="true" className="size-4" />
            {t('queue.qr.download')}
          </Button>
        </div>
      </div>
    </section>
  );
}
