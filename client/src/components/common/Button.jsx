import { Link } from 'react-router';
import { cn } from '../../utils/cn';

const BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';

const VARIANTS = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900',
  secondary:
    'border border-brand-700 bg-white text-brand-800 hover:bg-brand-50 active:bg-brand-100',
  ghost: 'text-slate-800 hover:bg-canvas-muted active:bg-line',
};

export function buttonClasses({ variant = 'primary', className } = {}) {
  return cn(BASE, VARIANTS[variant], className);
}

export function Button({ variant = 'primary', className, type = 'button', ...props }) {
  return <button type={type} className={buttonClasses({ variant, className })} {...props} />;
}

export function ButtonLink({ variant = 'primary', className, ...props }) {
  return <Link className={buttonClasses({ variant, className })} {...props} />;
}
