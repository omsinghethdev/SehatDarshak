import { useEffect, useId, useRef, useState } from 'react';
import { Ambulance, Building2, Loader2, MapPin, X } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';
import { AMBULANCE_PHONE, HOSPITAL_PHONE } from './emergencyConfig';

const actionClass =
  'flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left font-semibold text-slate-900 hover:bg-red-50 focus-visible:bg-red-50';

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

/** Medical cross with a heartbeat line, framed by two sweeping rings. Decorative. */
function EmergencyLogo({ className }) {
  const gradientId = useId();
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#991b1b" />
        </linearGradient>
      </defs>
      {/* Outer ring: over the top and down the left side. */}
      <path d="M88.97 27.5 A45 45 0 1 0 50 95" fill="none" stroke="#7f1d1d" strokeWidth="5" strokeLinecap="round" />
      {/* Inner ring: under the bottom and up the right side. */}
      <path d="M16.23 69.5 A39 39 0 0 0 86.65 36.66" fill="none" stroke="#f87171" strokeWidth="3.5" strokeLinecap="round" />
      {/* Cross. */}
      <rect x="38" y="22" width="24" height="56" rx="4" fill={`url(#${gradientId})`} />
      <rect x="22" y="38" width="56" height="24" rx="4" fill={`url(#${gradientId})`} />
      {/* Heartbeat line, redrawn on a loop. */}
      <polyline
        points="18,51 37,51 41,43 46,60 52,35 57,55 61,51 72,51"
        pathLength="1"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="animate-plus-beat"
        style={{ strokeDasharray: 1 }}
      />
      <circle cx="75" cy="51" r="2.75" fill="#fff" />
    </svg>
  );
}

/**
 * Floating red emergency button (bottom-right on every page). Opens a menu to call an
 * ambulance, share the current location with the hospital, or call the hospital.
 */
export function EmergencyButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // idle | locating | shared | copied | ready | error
  const [locationState, setLocationState] = useState({ status: 'idle' });
  const rootRef = useRef(null);
  const toggleRef = useRef(null);
  const menuId = useId();

  // Close on Escape or on a click outside the button and its menu.
  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  async function shareLocation() {
    setLocationState({ status: 'locating' });
    let position;
    try {
      position = await getPosition();
    } catch (error) {
      const reason = error?.code === 1 ? 'denied' : error?.message === 'unsupported' ? 'unsupported' : 'unavailable';
      setLocationState({ status: 'error', reason });
      return;
    }

    const { latitude, longitude } = position.coords;
    const mapUrl = `https://maps.google.com/?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
    const message = t('emergency.shareMessage', { url: mapUrl });

    // With a hospital number, open a ready-to-send SMS to the hospital.
    if (HOSPITAL_PHONE) {
      window.location.href = `sms:${HOSPITAL_PHONE}?body=${encodeURIComponent(message)}`;
      setLocationState({ status: 'ready', mapUrl });
      return;
    }

    // Otherwise let the person choose how to send it (WhatsApp, SMS…), or copy it.
    try {
      if (navigator.share) {
        await navigator.share({ title: t('emergency.shareTitle'), text: message, url: mapUrl });
        setLocationState({ status: 'shared', mapUrl });
        return;
      }
      await navigator.clipboard.writeText(message);
      setLocationState({ status: 'copied', mapUrl });
    } catch {
      // Share sheet dismissed or clipboard blocked: still show the link to read out on a call.
      setLocationState({ status: 'ready', mapUrl });
    }
  }

  return (
    <div ref={rootRef} className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6">
      {open && (
        <div
          id={menuId}
          role="dialog"
          aria-label={t('emergency.title')}
          className="w-72 rounded-xl border border-red-200 bg-white p-2 shadow-xl"
        >
          <p className="px-3 pt-2 pb-1 text-sm font-bold tracking-wide text-red-700 uppercase">
            {t('emergency.title')}
          </p>

          <a href={`tel:${AMBULANCE_PHONE}`} className={actionClass}>
            <Ambulance className="size-5 shrink-0 text-red-600" aria-hidden="true" />
            <span>
              {t('emergency.callAmbulance')}
              <span className="block text-sm font-normal text-slate-600">{AMBULANCE_PHONE}</span>
            </span>
          </a>

          <button
            type="button"
            onClick={shareLocation}
            disabled={locationState.status === 'locating'}
            className={cn(actionClass, 'disabled:cursor-wait disabled:opacity-70')}
          >
            {locationState.status === 'locating' ? (
              <Loader2 className="size-5 shrink-0 animate-spin text-red-600" aria-hidden="true" />
            ) : (
              <MapPin className="size-5 shrink-0 text-red-600" aria-hidden="true" />
            )}
            <span>
              {t('emergency.shareLocation')}
              <span className="block text-sm font-normal text-slate-600">
                {locationState.status === 'locating' ? t('emergency.locating') : t('emergency.shareLocationHint')}
              </span>
            </span>
          </button>

          {HOSPITAL_PHONE ? (
            <a href={`tel:${HOSPITAL_PHONE}`} className={actionClass}>
              <Building2 className="size-5 shrink-0 text-red-600" aria-hidden="true" />
              <span>
                {t('emergency.callHospital')}
                <span className="block text-sm font-normal text-slate-600">{HOSPITAL_PHONE}</span>
              </span>
            </a>
          ) : (
            <div className={cn(actionClass, 'cursor-not-allowed opacity-60 hover:bg-transparent')} aria-disabled="true">
              <Building2 className="size-5 shrink-0 text-slate-500" aria-hidden="true" />
              <span>
                {t('emergency.callHospital')}
                <span className="block text-sm font-normal text-slate-600">{t('emergency.hospitalNotSet')}</span>
              </span>
            </div>
          )}

          <div role="status" aria-live="polite" className="px-3 text-sm">
            {locationState.status === 'error' && (
              <p className="pb-2 text-red-700">{t(`emergency.locationError.${locationState.reason}`)}</p>
            )}
            {['shared', 'copied', 'ready'].includes(locationState.status) && (
              <p className="pb-2 text-slate-700">
                {t(`emergency.locationResult.${locationState.status}`)}{' '}
                <a href={locationState.mapUrl} target="_blank" rel="noreferrer" className="font-semibold text-red-700 underline">
                  {t('emergency.viewOnMap')}
                </a>
              </p>
            )}
          </div>
        </div>
      )}

      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={open ? t('emergency.close') : t('emergency.open')}
        className="relative grid size-16 place-items-center rounded-full bg-white shadow-lg sm:size-20"
      >
        {/* Soft pulsing halo, paused while the menu is open. */}
        {!open && <span aria-hidden="true" className="absolute inset-0 animate-plus-halo rounded-full bg-red-500/30" />}
        {open ? (
          <X className="relative size-8 text-red-700" strokeWidth={3} aria-hidden="true" />
        ) : (
          <EmergencyLogo className="relative size-full animate-plus-hover" />
        )}
      </button>
    </div>
  );
}
