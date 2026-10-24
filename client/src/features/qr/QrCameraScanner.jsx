import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Loader2 } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Notice } from '../../components/feedback/Notice';
import { useTranslation } from '../../hooks/useTranslation';

const SCAN_INTERVAL_MS = 300;

/**
 * What in-app camera scanning this browser supports. Uses the browser's built-in
 * BarcodeDetector (no QR library). Camera access needs a secure context (https or localhost).
 */
export function getCameraScanSupport() {
  if (typeof window === 'undefined') return 'unsupported';
  if (!window.isSecureContext) return 'insecure';
  if (!navigator.mediaDevices?.getUserMedia) return 'noCamera';
  if (typeof window.BarcodeDetector !== 'function') return 'unsupported';
  return 'supported';
}

function errorKind(error) {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'denied';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'noCamera';
    case 'NotSupportedError':
      return 'unsupported';
    default:
      return 'generic';
  }
}

/**
 * Camera QR scanner. The camera is requested only when the user presses "Start camera", frames
 * are read on this device only (nothing is uploaded or stored), and the stream is stopped when a
 * code is found, on cancel, when the tab is hidden, and on unmount.
 */
export function QrCameraScanner({ onResult }) {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const runRef = useRef(0); // bumped by stop(), so a camera that opens after cancel is closed at once
  const [state, setState] = useState('idle'); // idle | starting | scanning | found | error
  const [problem, setProblem] = useState(null);
  const support = getCameraScanSupport();

  const stop = useCallback(() => {
    runRef.current += 1;
    clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => stop, [stop]);

  useEffect(() => {
    function handleVisibility() {
      if (document.hidden && streamRef.current) {
        stop();
        setState('idle');
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [stop]);

  async function start() {
    setProblem(null);
    setState('starting');
    const run = ++runRef.current;
    try {
      if (typeof window.BarcodeDetector.getSupportedFormats === 'function') {
        const formats = await window.BarcodeDetector.getSupportedFormats();
        if (!formats.includes('qr_code')) throw Object.assign(new Error('QR not supported'), { name: 'NotSupportedError' });
      }
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (run !== runRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      if (run !== runRef.current) return;
      setState('scanning');

      const tick = async () => {
        if (!streamRef.current) return;
        try {
          const codes = await detector.detect(video);
          const value = codes.find((code) => code.rawValue)?.rawValue;
          if (value) {
            stop();
            setState('found');
            onResult(value);
            return;
          }
        } catch {
          // The frame was not ready yet; try the next one.
        }
        timerRef.current = setTimeout(tick, SCAN_INTERVAL_MS);
      };
      tick();
    } catch (error) {
      if (run !== runRef.current) return; // cancelled while starting
      stop();
      setProblem(errorKind(error));
      setState('error');
    }
  }

  function cancel() {
    stop();
    setState('idle');
  }

  if (support !== 'supported') {
    return (
      <Notice tone="info" title={t(`scan.errors.${support}.title`)}>
        {t(`scan.errors.${support}.body`)}
      </Notice>
    );
  }

  const active = state === 'starting' || state === 'scanning';

  return (
    <div className="space-y-4">
      {!active && <p className="text-sm text-slate-700">{t('scan.permissionHint')}</p>}

      <div hidden={!active} className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-xl bg-slate-900">
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label={t('scan.frameLabel')}
          className="size-full object-cover"
        />
        {/* Scanning frame: a clear square to aim at, dimming the rest of the picture. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-[15%] rounded-lg border-4 border-white shadow-[0_0_0_999px_rgb(15_23_42/0.45)]" />
        {state === 'starting' && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <Loader2 aria-hidden="true" className="size-8 animate-spin" />
          </div>
        )}
      </div>

      <p role="status" className="text-center font-medium text-slate-800">
        {state === 'starting' && t('scan.starting')}
        {state === 'scanning' && t('scan.scanning')}
        {state === 'found' && t('scan.found')}
      </p>

      {state === 'error' && problem && (
        <Notice tone="error" role="alert" title={t(`scan.errors.${problem}.title`)}>
          {t(`scan.errors.${problem}.body`)}
        </Notice>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        {active ? (
          <Button variant="secondary" onClick={cancel}>
            <CameraOff aria-hidden="true" className="size-5" />
            {t('scan.stopCamera')}
          </Button>
        ) : (
          <Button onClick={start}>
            <Camera aria-hidden="true" className="size-5" />
            {state === 'error' ? t('scan.tryCameraAgain') : t('scan.startCamera')}
          </Button>
        )}
      </div>
    </div>
  );
}
