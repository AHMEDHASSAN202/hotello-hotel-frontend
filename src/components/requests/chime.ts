/**
 * The new-request sound (15.4 AC3): a small, dignified two-tone chime,
 * synthesized with WebAudio — no asset to preload or cache. The context is
 * created lazily on first use; browsers unlock audio after the first user
 * gesture on the page (a board user has always interacted by then).
 */
let ctx: AudioContext | null = null;

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return ctx;
}

function tone(
  context: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(0.08, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration);
}

/** E5 → A5, ~0.45s total. Silently no-ops where WebAudio is unavailable. */
export function playRequestChime(): void {
  try {
    const context = ensureContext();
    if (!context) return;
    const now = context.currentTime;
    tone(context, 659.25, now, 0.28);
    tone(context, 880, now + 0.12, 0.33);
  } catch {
    // Sound is a courtesy — never let it break the board.
  }
}
