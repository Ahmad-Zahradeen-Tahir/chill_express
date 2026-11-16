"use client";
/**
 * Order alert sounds, generated with the Web Audio API (no audio files to host).
 * Browsers keep audio blocked until the person has clicked or typed on the page, so one shared
 * AudioContext is created and resumed on the first interaction; `audioBlocked()` reports the state.
 */
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new Ctx();
    } catch {
      return null;
    }
  }
  return ctx;
}

/** Call from a click/keypress handler to allow sound for the rest of the visit. */
export function unlockAudio(): Promise<void> {
  const c = getCtx();
  return c && c.state === "suspended" ? c.resume().catch(() => {}) : Promise.resolve();
}

export function audioBlocked(): boolean {
  const c = getCtx();
  return !c || c.state !== "running";
}

function tones(notes: number[], start: number, opts: { gap: number; len: number; gain: number; type: OscillatorType }) {
  const c = getCtx();
  if (!c) return;
  notes.forEach((f, i) => {
    const t = c.currentTime + start + i * opts.gap;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = opts.type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.len);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + opts.len + 0.05);
  });
}

/** Soft three-note chime (Live queue "Sound on"). */
export function chime() {
  tones([880, 1175, 1568], 0, { gap: 0.15, len: 0.4, gain: 0.3, type: "sine" });
}

/** Louder two-burst ring for the cashier's new-order popup. */
export function ring() {
  for (const start of [0, 0.75]) tones([1318, 1046, 1318, 1568], start, { gap: 0.11, len: 0.18, gain: 0.45, type: "triangle" });
}
