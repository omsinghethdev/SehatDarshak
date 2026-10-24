import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { TextField } from './TextField';

export function PasswordField({ id, label, ...props }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const fieldLabel = label ?? t('auth.password');

  return (
    <TextField
      id={id}
      label={fieldLabel}
      type={visible ? 'text' : 'password'}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-pressed={visible}
          aria-controls={id}
          className="inline-flex size-11 items-center justify-center rounded-md text-slate-700 hover:bg-canvas-muted hover:text-slate-900"
        >
          {visible ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
          <span className="sr-only">{visible ? t('form.hideValue', { label: fieldLabel }) : t('form.showValue', { label: fieldLabel })}</span>
        </button>
      }
      {...props}
    />
  );
}
