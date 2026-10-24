import { useEffect, useId, useRef } from 'react';
import { Button } from '../common/Button';
import { cn } from '../../utils/cn';

/**
 * Inline confirmation for sensitive actions (same pattern as the staff queue's cancel/skip
 * prompt): it appears next to the action, moves focus to the confirm button, and the caller
 * returns focus to the triggering control when it is dismissed.
 */
export function ConfirmPrompt({
  title,
  children,
  confirmLabel,
  pendingLabel = 'Working…',
  cancelLabel = 'Cancel',
  tone = 'warning',
  pending = false,
  onConfirm,
  onCancel,
  className,
}) {
  const confirmRef = useRef(null);
  const titleId = useId();
  useEffect(() => confirmRef.current?.focus(), []);

  return (
    <div
      role="group"
      aria-labelledby={titleId}
      className={cn(
        'rounded-lg border p-4',
        tone === 'danger' ? 'border-red-300 bg-red-50 text-red-950' : 'border-amber-300 bg-amber-50 text-amber-950',
        className,
      )}
    >
      <p id={titleId} className="font-semibold">
        {title}
      </p>
      {children && <div className="mt-1 text-sm leading-relaxed">{children}</div>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          ref={confirmRef}
          variant={tone === 'danger' ? 'danger' : 'primary'}
          onClick={() => !pending && onConfirm()}
          aria-disabled={pending || undefined}
        >
          {pending ? pendingLabel : confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </div>
  );
}
