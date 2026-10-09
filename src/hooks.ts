import { useEffect, useState } from "react";
import { aiStatus } from "./lib/api";

let cached: boolean | null = null;
let pending: Promise<boolean> | null = null;
const subscribers = new Set<(v: boolean) => void>();

/** Whether the server has an Anthropic key configured. Checked once per page load. */
export function useAIAvailable(): boolean {
  const [value, setValue] = useState<boolean>(cached ?? false);
  useEffect(() => {
    if (cached !== null) {
      setValue(cached);
      return;
    }
    subscribers.add(setValue);
    pending ??= aiStatus().then((v) => {
      cached = v;
      subscribers.forEach((s) => s(v));
      return v;
    });
    return () => {
      subscribers.delete(setValue);
    };
  }, []);
  return value;
}

/** Keeps the screen on during workouts where supported. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = () =>
      navigator.wakeLock
        .request("screen")
        .then((l) => {
          if (cancelled) void l.release();
          else lock = l;
        })
        .catch(() => {});
    void acquire();
    const onVis = () => document.visibilityState === "visible" && void acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release();
    };
  }, [active]);
}

/** Re-renders every `ms` while active; returns Date.now(). */
export function useNow(active: boolean, ms = 200): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [active, ms]);
  return now;
}
