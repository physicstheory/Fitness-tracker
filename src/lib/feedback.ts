import { getState } from "../store";

let ctx: AudioContext | null = null;

/** Must be called from a user gesture once so iOS allows audio later. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    // Audio not supported.
  }
}

function tone(freq: number, durationMs: number, delayMs = 0, volume = 0.25) {
  if (!getState().settings.sound || !ctx) return;
  const start = ctx.currentTime + delayMs / 1000;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + durationMs / 1000);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + durationMs / 1000 + 0.05);
}

function vibrate(pattern: number | number[]) {
  if (getState().settings.vibrate && "vibrate" in navigator) navigator.vibrate(pattern);
}

export const feedback = {
  tap() {
    tone(880, 60, 0, 0.12);
    vibrate(15);
  },
  tick() {
    if (getState().settings.countdownBeeps) tone(660, 120);
  },
  done() {
    tone(784, 160);
    tone(1046, 260, 170);
    vibrate([120, 60, 120]);
  },
  celebrate() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 200, i * 120));
    vibrate([80, 40, 80, 40, 200]);
  },
};
