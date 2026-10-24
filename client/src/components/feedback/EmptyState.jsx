import { Inbox } from 'lucide-react';
import { cn } from '../../utils/cn';

export function EmptyState({ icon: Icon = Inbox, title, description, action, className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-xl border border-dashed border-line bg-white px-6 py-10 text-center',
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-canvas-muted">
        <Icon aria-hidden="true" className="size-6 text-slate-600" />
      </span>
      <p className="mt-4 text-lg font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-md text-slate-700">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
