import { useId, useRef, useState } from 'react';
import { XCircle } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { ErrorState } from '../../components/feedback/ErrorState';
import { useTranslation } from '../../hooks/useTranslation';
import { API_ERROR_CODES } from '../../services/apiClient';
import { queueService } from './queueService';

/**
 * "Cancel token" for the patient's own token, offered only while it is waiting. The server is
 * the authority: nothing changes on the page until it confirms, and a 409 (for example, staff
 * called the token a moment earlier) is reported through `onConflict` so the page can reload.
 *
 * Uses a native modal <dialog>, which traps focus and closes on Escape. Focus starts on the safe
 * "Keep my token" button. The dialog stays mounted while the token is active, so a status change
 * that arrives while it is open is explained inside it instead of the dialog vanishing.
 */
export function CancelTokenSection({ token, onCancelled, onConflict }) {
  const { t } = useTranslation();
  const ids = useId();
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const keepRef = useRef(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const waiting = token.status === 'waiting';

  function openDialog() {
    setError(null);
    dialogRef.current?.showModal();
    keepRef.current?.focus();
  }

  function closeDialog() {
    if (pending) return;
    dialogRef.current?.close();
  }

  async function confirmCancel() {
    if (pending || !waiting) return;
    setPending(true);
    setError(null);
    try {
      const updated = await queueService.cancelToken(token.id);
      dialogRef.current?.close();
      onCancelled(updated);
    } catch (caught) {
      if (caught?.code === API_ERROR_CODES.CONFLICT) {
        dialogRef.current?.close();
        onConflict();
      } else {
        setError(caught);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {waiting && (
        <section aria-labelledby={`${ids}-heading`} className="rounded-xl border border-line bg-white p-5 sm:p-6">
          <h2 id={`${ids}-heading`} className="text-lg font-semibold text-slate-900">
            {t('queue.cancel.heading')}
          </h2>
          <p className="mt-1 text-slate-700">{t('queue.cancel.intro')}</p>
          <Button ref={triggerRef} variant="danger" className="mt-4" onClick={openDialog}>
            <XCircle aria-hidden="true" className="size-5" />
            {t('queue.cancel.action')}
          </Button>
        </section>
      )}

      {/* Escape is ignored while the request is in flight, so its result is never hidden. On close,
          focus returns to the trigger, or to <main> if the token is no longer waiting. */}
      <dialog
        ref={dialogRef}
        aria-labelledby={`${ids}-title`}
        aria-describedby={`${ids}-body`}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        onClose={() => (triggerRef.current ?? document.getElementById('main-content'))?.focus()}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-line bg-white p-0 text-slate-900 shadow-raised backdrop:bg-slate-900/50"
      >
        <div className="space-y-4 p-6">
          <h2 id={`${ids}-title`} className="text-xl font-bold text-slate-900">
            {waiting ? t('queue.cancel.confirmTitle', { number: token.displayNumber }) : t('queue.cancel.unavailableTitle')}
          </h2>
          <p id={`${ids}-body`} className="text-slate-700">
            {waiting ? t('queue.cancel.confirmBody') : t('queue.cancel.unavailableBody', { status: t(`status.${token.status}.label`) })}
          </p>
          {error && <ErrorState error={error} showDetails={false} />}
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button ref={keepRef} variant="secondary" onClick={closeDialog} aria-disabled={pending || undefined}>
              {waiting ? t('queue.cancel.keep') : t('queue.cancel.close')}
            </Button>
            {waiting && (
              <Button variant="danger" onClick={confirmCancel} aria-disabled={pending || undefined}>
                {pending ? t('queue.cancel.cancelling') : t('queue.cancel.confirm')}
              </Button>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
