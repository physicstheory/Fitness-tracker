import type { AppState, Goal, WorkoutLog } from "../types";

export const dayKey = (d: Date | string) => {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export const addDays = (d: Date, n: number) => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};

export function logTotal(log: WorkoutLog, exerciseId?: string): number {
  return log.entries
    .filter((e) => !exerciseId || e.exerciseId === exerciseId)
    .reduce((sum, e) => sum + e.sets.reduce((a, s) => a + s.actual, 0), 0);
}

/** Total reps (or seconds) per day for the last `days` days, oldest first. */
export function dailyTotals(logs: WorkoutLog[], days: number, exerciseId?: string) {
  const map = new Map<string, number>();
  for (const log of logs) map.set(dayKey(log.date), (map.get(dayKey(log.date)) ?? 0) + logTotal(log, exerciseId));
  const today = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(today, i - days + 1);
    return { date: d, key: dayKey(d), value: map.get(dayKey(d)) ?? 0 };
  });
}

export function streak(logs: WorkoutLog[]): { current: number; best: number } {
  const days = new Set(logs.map((l) => dayKey(l.date)));
  let current = 0;
  let cursor = new Date();
  if (!days.has(dayKey(cursor))) cursor = addDays(cursor, -1); // today not done yet still keeps the streak
  while (days.has(dayKey(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of sorted) {
    run = prev && dayKey(addDays(new Date(prev + "T12:00"), 1)) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return { current, best: Math.max(best, current) };
}

export function bestSet(logs: WorkoutLog[], exerciseId: string): number {
  let best = 0;
  for (const log of logs)
    for (const e of log.entries) if (e.exerciseId === exerciseId) for (const s of e.sets) best = Math.max(best, s.actual);
  return best;
}

export function lifetimeTotal(logs: WorkoutLog[], exerciseId: string): number {
  return logs.reduce((sum, l) => sum + logTotal(l, exerciseId), 0);
}

/** Current value of a goal's metric. */
export function goalProgress(goal: Goal, logs: WorkoutLog[]): number {
  if (goal.metric === "max_set") return Math.max(goal.baseline, bestSet(logs, goal.exerciseId));
  if (goal.metric === "daily_total") {
    const totals = dailyTotals(logs, 3650, goal.exerciseId);
    return Math.max(goal.baseline, ...totals.map((t) => t.value));
  }
  return logs.filter((l) => new Date(l.date).getTime() >= goal.createdAt).reduce((s, l) => s + logTotal(l, goal.exerciseId), 0);
}

/** Compact summary of recent training for the AI. */
export function historySummary(state: AppState, exerciseId?: string) {
  const recent = state.logs.slice(0, 15);
  return recent.map((l) => ({
    date: dayKey(l.date),
    title: l.title,
    entries: l.entries
      .filter((e) => !exerciseId || e.exerciseId === exerciseId)
      .map((e) => ({ exercise: e.exerciseId, sets: e.sets.map((s) => `${s.actual}/${s.target || "max"}`).join(", ") })),
  }));
}

export const fmtTime = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
};

export const fmtDuration = (sec: number) => {
  const m = Math.round(sec / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
};
