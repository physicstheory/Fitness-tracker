import { exerciseMuscles, type MuscleId } from "./muscles";
import { findExercise } from "../store";
import type { AppState, Exercise, WorkoutLog } from "../types";

// ---------- XP & levels ----------

/** Effort of one set in "rep equivalents": weight adds load, timed sets count seconds. */
export function setEffort(ex: Exercise | undefined, actual: number, weight?: number, unit?: "kg" | "lb"): number {
  if (!ex) return actual;
  if (ex.type === "time") return actual / 3;
  const kg = weight ? (unit === "lb" ? weight * 0.4536 : weight) : 0;
  return actual * (1 + kg / 20);
}

export function workoutXP(log: WorkoutLog, s: AppState): number {
  let xp = 40; // showing up
  for (const e of log.entries) {
    const ex = findExercise(e.exerciseId, s);
    for (const set of e.sets) xp += setEffort(ex, set.actual, set.weight, set.unit) * 1.5 + 4;
  }
  return Math.round(xp);
}

export function totalXP(s: AppState): number {
  return s.logs.reduce((sum, l) => sum + workoutXP(l, s), 0);
}

const LEVEL_TITLES = ["Rookie", "Beginner", "Regular", "Committed", "Athlete", "Grinder", "Beast", "Elite", "Titan", "Legend"];

/** Reaching level n+1 takes 200·n^1.8 XP in total. */
const xpForLevel = (n: number) => 200 * Math.pow(n, 1.8);
export function levelFor(xp: number) {
  let level = 1;
  while (xpForLevel(level) <= xp) level++;
  const floor = level === 1 ? 0 : xpForLevel(level - 1);
  const next = xpForLevel(level);
  return {
    level,
    title: LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.floor((level - 1) / 3))],
    into: xp - floor,
    needed: next - floor,
    progress: (xp - floor) / (next - floor),
  };
}

// ---------- Muscle ranks ----------

export interface Tier {
  name: string;
  min: number;
  color: string;
  emoji: string;
}

/** Ranks come from training volume on each muscle over the last 30 days. */
export const TIERS: Tier[] = [
  { name: "Unranked", min: 0, color: "var(--muscle)", emoji: "▫️" },
  { name: "Bronze", min: 40, color: "#c27c4e", emoji: "🥉" },
  { name: "Silver", min: 120, color: "#b8c2cf", emoji: "🥈" },
  { name: "Gold", min: 300, color: "#f2c14e", emoji: "🥇" },
  { name: "Platinum", min: 650, color: "#5fd4c6", emoji: "💠" },
  { name: "Diamond", min: 1200, color: "#5aa9ff", emoji: "💎" },
  { name: "Champion", min: 2200, color: "#b07cff", emoji: "🏆" },
  { name: "Legend", min: 3800, color: "#ff5a36", emoji: "🔥" },
];

export const tierFor = (score: number): Tier => [...TIERS].reverse().find((t) => score >= t.min) ?? TIERS[0];

const DAY = 86400000;

/** Volume per muscle (primary counts fully, secondary half) since `sinceMs`. */
export function muscleVolume(s: AppState, sinceMs: number): Partial<Record<MuscleId, number>> {
  const out: Partial<Record<MuscleId, number>> = {};
  for (const log of s.logs) {
    if (new Date(log.date).getTime() < sinceMs) continue;
    for (const e of log.entries) {
      const ex = findExercise(e.exerciseId, s);
      if (!ex) continue;
      const { primary, secondary } = exerciseMuscles(ex.muscleGroups, ex.primaryCount);
      const effort = e.sets.reduce((a, set) => a + setEffort(ex, set.actual, set.weight, set.unit), 0);
      primary.forEach((m) => (out[m] = (out[m] ?? 0) + effort));
      secondary.forEach((m) => (out[m] = (out[m] ?? 0) + effort * 0.5));
    }
  }
  return out;
}

export function muscleRanks(s: AppState) {
  const vol = muscleVolume(s, Date.now() - 30 * DAY);
  return Object.fromEntries(Object.entries(vol).map(([m, v]) => [m, { score: Math.round(v ?? 0), tier: tierFor(v ?? 0) }])) as Partial<
    Record<MuscleId, { score: number; tier: Tier }>
  >;
}
