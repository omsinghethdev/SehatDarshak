/*
 * Optional read-aloud using the browser's built-in speech synthesis (no external service).
 * One shared controller means only one thing is spoken at a time; starting new speech stops
 * the previous one. Speech never starts on its own — only from an explicit "Listen" press.
 */

const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;

export function isSpeechSupported() {
  return Boolean(synth && typeof window.SpeechSynthesisUtterance === 'function');
}

let current = null; // { id, utterance }
const listeners = new Set();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeSpeech(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Id of the control currently speaking, or null. */
export function getSpeakingId() {
  return current?.id ?? null;
}

/** Voices load asynchronously in some browsers; wait briefly for them. */
function loadVoices(timeoutMs = 1500) {
  const voices = synth.getVoices();
  if (voices.length > 0) return Promise.resolve(voices);
  return new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener?.('voiceschanged', done);
      clearTimeout(timer);
      resolve(synth.getVoices());
    };
    const timer = setTimeout(done, timeoutMs);
    synth.addEventListener?.('voiceschanged', done);
  });
}

function findVoice(voices, langTag) {
  const wanted = langTag.toLowerCase();
  const base = wanted.split('-')[0];
  return (
    voices.find((voice) => voice.lang?.toLowerCase() === wanted) ??
    voices.find((voice) => voice.lang?.toLowerCase().replace('_', '-').split('-')[0] === base) ??
    null
  );
}

export function stopSpeech() {
  if (!synth) return;
  const wasSpeaking = current !== null;
  current = null;
  synth.cancel();
  if (wasSpeaking) emit();
}

/**
 * Speak `text` in `langTag` (e.g. "hi-IN"). Resolves to { ok: true } or
 * { ok: false, reason: 'unsupported' | 'noVoice' }. A matching voice is required: reading
 * Hindi text with an English voice would be unintelligible, so we report it instead.
 */
export async function speak({ id, text, langTag }) {
  if (!isSpeechSupported()) return { ok: false, reason: 'unsupported' };
  stopSpeech();
  const voice = findVoice(await loadVoices(), langTag);
  if (!voice) return { ok: false, reason: 'noVoice' };

  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = 0.9; // A little slower than default, for clarity.
  const finish = () => {
    if (current?.utterance === utterance) {
      current = null;
      emit();
    }
  };
  utterance.onend = finish;
  utterance.onerror = finish;
  current = { id, utterance };
  emit();
  synth.speak(utterance);
  return { ok: true };
}
