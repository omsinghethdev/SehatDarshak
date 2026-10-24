import { useId, useState } from 'react';
import { ImageUp, Link2 } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { TextField } from '../../components/forms/TextField';
import { useTranslation } from '../../hooks/useTranslation';
import { buildScanPath } from './qrPayload';

/**
 * Read a QR code from a photo with the browser's BarcodeDetector. The image is decoded in memory
 * on this device and discarded; it is never uploaded or stored. Hidden when unsupported.
 */
export function QrImageUpload({ onResult }) {
  const { t } = useTranslation();
  const inputId = useId();
  const [status, setStatus] = useState('idle'); // idle | reading | notFound

  if (typeof window.BarcodeDetector !== 'function' || typeof window.createImageBitmap !== 'function') return null;

  async function handleChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setStatus('reading');
    try {
      const bitmap = await window.createImageBitmap(file);
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      const codes = await detector.detect(bitmap);
      bitmap.close?.();
      const value = codes.find((code) => code.rawValue)?.rawValue;
      if (!value) {
        setStatus('notFound');
        return;
      }
      setStatus('idle');
      onResult(value);
    } catch {
      setStatus('notFound');
    }
  }

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-brand-700 bg-white px-5 py-2.5 font-semibold text-brand-800 hover:bg-brand-50 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-focus)]"
      >
        <ImageUp aria-hidden="true" className="size-5" />
        {t('scan.uploadLabel')}
        <input id={inputId} type="file" accept="image/*" onChange={handleChange} className="sr-only" />
      </label>
      <p className="text-sm text-slate-600">{t('scan.uploadHint')}</p>
      <p role="status" className="text-sm font-medium text-slate-800">
        {status === 'reading' && t('scan.reading')}
        {status === 'notFound' && t('scan.uploadNotFound')}
      </p>
    </div>
  );
}

/** Text alternative to the camera: type or paste the QR link. Validation happens in the parent. */
export function QrManualEntry({ onSubmit, error }) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const example = `${window.location.origin}${buildScanPath({ type: 'location', id: 'room_registration' })}`;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value);
      }}
      className="space-y-3"
    >
      <TextField
        id="qr-link"
        label={t('scan.manualLabel')}
        hint={t('scan.manualHint', { example })}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        inputMode="url"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        error={error}
      />
      <Button type="submit" variant="secondary">
        <Link2 aria-hidden="true" className="size-5" />
        {t('scan.open')}
      </Button>
    </form>
  );
}
