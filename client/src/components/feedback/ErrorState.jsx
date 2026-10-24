import { RotateCcw } from 'lucide-react';
import { Button } from '../common/Button';
import { Notice } from './Notice';
import { getErrorContent } from '../../utils/errorMessages';

/**
 * Accessible error message for a failed request. Pass an `ApiError` (or any error)
 * and optionally `title`/`description` overrides and an `onRetry` handler.
 * Set `showDetails={false}` when field-level errors are already shown next to inputs.
 */
export function ErrorState({ error, title, description, onRetry, showDetails = true, className }) {
  const content = getErrorContent(error);

  return (
    <Notice
      tone="error"
      role="alert"
      title={title ?? content.title}
      className={className}
      action={
        onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            <RotateCcw aria-hidden="true" className="size-4" />
            Try again
          </Button>
        )
      }
    >
      <p>{description ?? content.description}</p>
      {showDetails && content.details?.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {content.details.map((detail, index) => (
            <li key={`${detail.field ?? 'detail'}-${index}`}>{detail.message}</li>
          ))}
        </ul>
      )}
    </Notice>
  );
}
