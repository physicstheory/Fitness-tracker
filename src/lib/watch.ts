import { apiBase } from "./api";
import { findExercise, getState } from "../store";
import type { ProgramItem } from "../types";

// Phone side of the Garmin watch link (see server/watch.ts and garmin/).

export interface WatchEvent {
  seq: number;
  type: "reps" | "set";
  i: number;
  s: number;
  reps: number;
}

export const watchCode = () => getState().settings.watchCode?.trim() || "";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiBase() + path, init);
  if (!res.ok) throw new Error(`Watch link error ${res.status}`);
  return (await res.json()) as T;
}

export function pushPlan(plan: { title: string; items: ProgramItem[]; pos: { i: number; s: number }; phase: string; restLeft: number }) {
  const code = watchCode();
  if (!code) return Promise.resolve(null);
  return call<{ ok: boolean; watchSeen: number }>("/api/watch/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      title: plan.title,
      pos: plan.pos,
      phase: plan.phase,
      restLeft: plan.restLeft,
      items: plan.items.map((it) => {
        const ex = findExercise(it.exerciseId);
        return { name: ex?.name ?? "Exercise", type: ex?.type ?? "reps", targets: it.sets, restSec: it.restSec };
      }),
    }),
  }).catch(() => null);
}

export function pollEvents(after: number) {
  const code = watchCode();
  return call<{ last: number; watchSeen: number; events: WatchEvent[] }>(`/api/watch/events?code=${code}&after=${after}`);
}

/** Checks the link and when the watch last checked in. */
export async function testWatch(code: string): Promise<{ ok: boolean; watchSeen: number; error?: string }> {
  try {
    const r = await call<{ watchSeen: number }>(`/api/watch/events?code=${code}&after=-1`);
    return { ok: true, watchSeen: r.watchSeen };
  } catch (e) {
    return { ok: false, watchSeen: 0, error: (e as Error).message };
  }
}
