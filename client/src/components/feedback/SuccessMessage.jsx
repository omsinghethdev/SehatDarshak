import { Notice } from './Notice';

export function SuccessMessage({ title, children, action, className }) {
  return (
    <Notice tone="success" role="status" title={title} action={action} className={className}>
      {children}
    </Notice>
  );
}
