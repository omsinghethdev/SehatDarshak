import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { Square, Volume2 } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { getSpeakingId, isSpeechSupported, speak, stopSpeech, subscribeSpeech } from '../../lib/speech';
import { cn } from '../../utils/cn';
import { Button } from './Button';

/**
 * "Listen" control that reads `text` aloud in the selected language, and becomes "Stop" while
 * speaking. Hidden when the browser has no speech synthesis. Spoken output is always an extra:
 * the same information is on screen.
 *
 * `text` may be a function, so the latest wording is read at the moment of pressing.
 */
export function ListenButton({ text, label, className }) {
  const id = useId();
  const { t, language } = useTranslation();
  const speakingId = useSyncExternalStore(subscribeSpeech, getSpeakingId, () => null);
  const [problem, setProblem] = useState(null);
  const speaking = speakingId === id;

  // Stop if this control disappears while speaking (e.g. navigating away).
  useEffect(() => () => {
    if (getSpeakingId() === id) stopSpeech();
  }, [id]);

  if (!isSpeechSupported()) return null;

  async function handleClick() {
    if (speaking) {
      stopSpeech();
      return;
    }
    setProblem(null);
    const content = typeof text === 'function' ? text() : text;
    const result = await speak({ id, text: content, langTag: language.speechLang });
    if (!result.ok) setProblem(result.reason);
  }

  return (
    <span className={cn('inline-flex flex-col items-start gap-1', className)}>
      <Button variant="secondary" onClick={handleClick} aria-pressed={speaking}>
        {speaking ? <Square aria-hidden="true" className="size-4" /> : <Volume2 aria-hidden="true" className="size-5" />}
        {speaking ? t('speech.stop') : label ?? t('speech.listen')}
      </Button>
      <span role="status" className="text-sm text-slate-700">
        {problem === 'noVoice' && t('speech.noVoice', { language: language.nativeName })}
        {problem === 'unsupported' && t('speech.unsupported')}
      </span>
    </span>
  );
}
