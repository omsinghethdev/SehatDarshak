import { Loader2 } from 'lucide-react';
import { Button } from '../common/Button';
import { cn } from '../../utils/cn';

/**
 * Submit button with a pending state. It stays focusable while pending (aria-disabled
 * instead of disabled) so keyboard focus is not lost; forms must ignore repeat submits.
 */
export function SubmitButton({ pending, pendingLabel, children, className, ...props }) {
  return (
    <Button
      type="submit"
      aria-disabled={pending || undefined}
      className={cn(pending && 'cursor-wait opacity-75', className)}
      {...props}
    >
      {pending && <Loader2 aria-hidden="true" className="size-5 animate-spin" />}
      {pending ? pendingLabel : children}
    </Button>
  );
}
