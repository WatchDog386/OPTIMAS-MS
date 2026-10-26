import { Platform } from 'react-native';

/*
 * Notification chime for the web/PWA build, synthesised with the Web Audio API (no audio file to
 * download or cache). Browsers only allow sound after the person has interacted with the page, so the
 * audio context is unlocked on the first tap. On native, push notifications already play the system sound.
 */

type Ctx = AudioContext;
let ctx: Ctx | null = null;

function context(): Ctx | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  return ctx;
}

/** Call once at start-up: resumes audio on the first touch/click so later chimes are allowed. */
export function unlockAudioOnFirstTouch() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const unlock = () => {
    void context()?.resume();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

/** Two soft rising notes (E6 → A6) with a quick fade — noticeable without being harsh. */
export function playChime() {
  const ac = context();
  if (!ac || ac.state !== 'running') return;
  const notes = [1318.5, 1760];
  notes.forEach((freq, i) => {
    const start = ac.currentTime + i * 0.14;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.22, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + 0.5);
  });
  // A short buzz on Android phones as well
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.([60, 40, 60]);
}
