import { exerciseMuscles, MUSCLE_NAMES, type MuscleId } from "./muscles";
import { dayKey, lastWeight, streak } from "./stats";
import { allExercises, canDo, findExercise } from "../store";
import type { AppState, Exercise, ProgramItem, SetLog } from "../types";

// An offline coach: everything here is computed from the user's own logs, no AI needed.

const HOUR = 3600000;
const DAY = 24 * HOUR;

// ---------- Recovery ----------

export type Recovery = "fresh" | "recovering" | "fatigued";

/** Hours since each muscle was last trained as a primary mover. */
export function lastTrained(s: AppState): Partial<Record<MuscleId, number>> {
  const out: Partial<Record<MuscleId, number>> = {};
  for (const log of s.logs) {
    const t = new Date(log.date).getTime();
    for (const e of log.entries) {
      const ex = findExercise(e.exerciseId, s);
      if (!ex) continue;
      for (const m of exerciseMuscles(ex.muscleGroups, ex.primaryCount).primary) out[m] = Math.max(out[m] ?? 0, t);
    }
  }
  return Object.fromEntries(Object.entries(out).map(([m, t]) => [m, (Date.now() - (t as number)) / HOUR])) as Partial<Record<MuscleId, number>>;
}

export function recoveryOf(hours: number | undefined): Recovery {
  if (hours === undefined || hours >= 72) return "fresh";
  return hours >= 30 ? "recovering" : "fatigued";
}

export const RECOVERY_COLOR: Record<Recovery, string> = { fresh: "#2fb67c", recovering: "#ffb020", fatigued: "#ff4d5e" };

// ---------- Weekly sets per muscle ----------

const MAJOR: MuscleId[] = ["chest", "lats", "upper_back", "shoulders", "quads", "hamstrings", "glutes"];
const TARGET_SETS: Partial<Record<MuscleId, [number, number]>> = {
  chest: [10, 20], lats: [10, 20], upper_back: [8, 18], shoulders: [8, 18], quads: [10, 20], hamstrings: [8, 16], glutes: [8, 18],
  biceps: [6, 14], triceps: [6, 14], abs: [6, 16], calves: [6, 14],
};

export function weeklySets(s: AppState): Partial<Record<MuscleId, number>> {
  const since = Date.now() - 7 * DAY;
  const out: Partial<Record<MuscleId, number>> = {};
  for (const log of s.logs) {
    if (new Date(log.date).getTime() < since) continue;
    for (const e of log.entries) {
      const ex = findExercise(e.exerciseId, s);
      if (!ex) continue;
      const { primary, secondary } = exerciseMuscles(ex.muscleGroups, ex.primaryCount);
      primary.forEach((m) => (out[m] = (out[m] ?? 0) + e.sets.length));
      secondary.forEach((m) => (out[m] = (out[m] ?? 0) + e.sets.length * 0.5));
    }
  }
  return out;
}

// ---------- Progressive overload ----------

export interface Progression {
  exerciseId: string;
  last: SetLog[];
  /** Plain-language suggestion for next time. */
  advice: string;
  nextWeight?: number;
  nextReps?: number;
  trend: "up" | "hold" | "down";
}

/** Looks at the most recent session of an exercise and suggests the next step. */
export function progressionFor(s: AppState, exerciseId: string): Progression | null {
  const ex = findExercise(exerciseId, s);
  if (!ex) return null;
  const log = s.logs.find((l) => l.entries.some((e) => e.exerciseId === exerciseId));
  const entry = log?.entries.find((e) => e.exerciseId === exerciseId);
  if (!entry || !entry.sets.length) return null;
  const sets = entry.sets;
  const hitAll = sets.every((x) => x.target === 0 || x.actual >= x.target);
  const missedBadly = sets.some((x) => x.target > 0 && x.actual < x.target * 0.75);
  const unit = sets.find((x) => x.unit)?.unit ?? s.settings.units;
  const best = Math.max(...sets.map((x) => x.actual));

  if (ex.weighted) {
    const w = sets.find((x) => x.weight)?.weight ?? lastWeight(s.logs, exerciseId) ?? 0;
    const heavy = (ex.equipmentIds ?? []).some((id) => id === "barbell" || id === "leg_press" || id === "machines" || id === "cable");
    // Typical plate/dumbbell jumps.
    const step = unit === "kg" ? (heavy ? 2.5 : 2) : 5;
    if (!w) return { exerciseId, last: sets, trend: "hold", advice: "Log a weight next time so I can track your progress." };
    if (hitAll) return { exerciseId, last: sets, trend: "up", nextWeight: w + step, advice: `You hit every set at ${w}${unit}. Go up to ${w + step}${unit}.` };
    if (missedBadly) return { exerciseId, last: sets, trend: "down", nextWeight: Math.max(0, w - step), advice: `That was a grind. Drop to ${Math.max(0, w - step)}${unit} and own every rep.` };
    return { exerciseId, last: sets, trend: "hold", nextWeight: w, advice: `Stay at ${w}${unit} and aim to hit every target rep.` };
  }
  if (ex.type === "time") {
    return hitAll
      ? { exerciseId, last: sets, trend: "up", nextReps: best + 10, advice: `Solid holds. Add 10s next time (${best + 10}s).` }
      : { exerciseId, last: sets, trend: "hold", nextReps: best, advice: `Match ${best}s on every set before adding time.` };
  }
  if (hitAll) return { exerciseId, last: sets, trend: "up", nextReps: best + 1, advice: `All targets hit. Add a rep to each set (best set: ${best}).` };
  if (missedBadly) return { exerciseId, last: sets, trend: "down", advice: "Tough session. Repeat it before progressing, and rest a little longer between sets." };
  return { exerciseId, last: sets, trend: "hold", advice: `Close! Repeat this and try to beat ${best} on your best set.` };
}

// ---------- Insights ----------

export interface Insight {
  icon: string;
  title: string;
  body: string;
  tone: "good" | "warn" | "info";
}

export function insights(s: AppState): Insight[] {
  const out: Insight[] = [];
  const logs = s.logs;
  if (!logs.length) {
    return [{ icon: "👋", title: "Let's get your first workout in", body: "Log a session and I'll start tracking recovery, volume and progress for every muscle.", tone: "info" }];
  }
  const now = Date.now();
  const daysSince = (now - new Date(logs[0].date).getTime()) / DAY;
  const thisWeek = logs.filter((l) => now - new Date(l.date).getTime() < 7 * DAY).length;
  const lastWeek = logs.filter((l) => {
    const d = now - new Date(l.date).getTime();
    return d >= 7 * DAY && d < 14 * DAY;
  }).length;
  const { current } = streak(logs);

  if (daysSince >= 3) out.push({ icon: "⏰", title: `${Math.floor(daysSince)} days since your last workout`, body: "Even a 15-minute session keeps momentum going. Try a generated workout below.", tone: "warn" });
  else if (current >= 3) out.push({ icon: "🔥", title: `${current}-day streak`, body: "Great consistency. Make sure at least one or two days a week are lighter so you recover.", tone: "good" });

  if (thisWeek > lastWeek && lastWeek > 0) out.push({ icon: "📈", title: `${thisWeek} workouts this week`, body: `Up from ${lastWeek} last week. Nice work.`, tone: "good" });

  const sets = weeklySets(s);
  const low = MAJOR.filter((m) => (sets[m] ?? 0) < (TARGET_SETS[m]?.[0] ?? 8) / 2 && (sets[m] ?? 0) > 0);
  const untouched = MAJOR.filter((m) => !sets[m]);
  if (untouched.length && thisWeek >= 2) out.push({ icon: "🎯", title: `No ${untouched.slice(0, 3).map((m) => MUSCLE_NAMES[m].toLowerCase()).join(", ")} work this week`, body: "Add an exercise or two for these to keep your training balanced.", tone: "info" });
  else if (low.length) out.push({ icon: "📊", title: "Low weekly volume", body: `${low.map((m) => MUSCLE_NAMES[m]).join(", ")} ${low.length > 1 ? "are" : "is"} under half the suggested weekly sets.`, tone: "info" });

  const push = (sets.chest ?? 0) + (sets.shoulders ?? 0) * 0.5;
  const pull = (sets.lats ?? 0) + (sets.upper_back ?? 0);
  if (push >= 8 && pull < push * 0.5) out.push({ icon: "⚖️", title: "Push-heavy week", body: "You're doing much more pushing than pulling. Add rows or pull-ups to protect your shoulders and posture.", tone: "warn" });
  const quads = sets.quads ?? 0;
  const hams = sets.hamstrings ?? 0;
  if (quads >= 8 && hams < quads * 0.4) out.push({ icon: "🦵", title: "Quads outpacing hamstrings", body: "Add Romanian deadlifts, leg curls or bridges to balance your legs.", tone: "info" });

  const recentPR = prThisWeek(s);
  if (recentPR) out.push({ icon: "🏅", title: "New personal record", body: recentPR, tone: "good" });

  const fatigued = Object.entries(lastTrained(s)).filter(([, h]) => recoveryOf(h) === "fatigued").map(([m]) => MUSCLE_NAMES[m as MuscleId]);
  if (fatigued.length) out.push({ icon: "🛌", title: "Still recovering", body: `${fatigued.slice(0, 4).join(", ")} were trained in the last day. Train something else today, or go light.`, tone: "info" });

  return out.slice(0, 6);
}

function prThisWeek(s: AppState): string | null {
  const since = Date.now() - 7 * DAY;
  for (const log of s.logs) {
    if (new Date(log.date).getTime() < since) break;
    for (const e of log.entries) {
      const ex = findExercise(e.exerciseId, s);
      if (!ex) continue;
      const older = s.logs.filter((l) => new Date(l.date).getTime() < new Date(log.date).getTime());
      const bestNow = Math.max(...e.sets.map((x) => (ex.weighted ? x.weight ?? 0 : x.actual)));
      const bestBefore = Math.max(0, ...older.flatMap((l) => l.entries.filter((x) => x.exerciseId === e.exerciseId).flatMap((x) => x.sets.map((y) => (ex.weighted ? y.weight ?? 0 : y.actual)))));
      if (bestBefore > 0 && bestNow > bestBefore) return `${ex.name}: ${bestNow}${ex.weighted ? s.settings.units : ex.type === "time" ? "s" : " reps"} (was ${bestBefore}).`;
    }
  }
  return null;
}

// ---------- Workout generator ----------

export type Focus = "full" | "upper" | "lower" | "push" | "pull" | "legs" | "core" | "chest" | "back" | "arms" | "shoulders" | "cardio";

export const FOCI: { id: Focus; label: string; muscles: MuscleId[] }[] = [
  { id: "full", label: "Full body", muscles: ["chest", "lats", "upper_back", "quads", "glutes", "hamstrings", "shoulders", "abs"] },
  { id: "upper", label: "Upper body", muscles: ["chest", "lats", "upper_back", "shoulders", "biceps", "triceps"] },
  { id: "lower", label: "Lower body", muscles: ["quads", "glutes", "hamstrings", "calves", "adductors"] },
  { id: "push", label: "Push", muscles: ["chest", "shoulders", "triceps"] },
  { id: "pull", label: "Pull", muscles: ["lats", "upper_back", "biceps", "traps", "forearms"] },
  { id: "legs", label: "Legs", muscles: ["quads", "hamstrings", "glutes", "calves"] },
  { id: "core", label: "Core", muscles: ["abs", "obliques", "lower_back", "hip_flexors"] },
  { id: "chest", label: "Chest", muscles: ["chest"] },
  { id: "back", label: "Back", muscles: ["lats", "upper_back", "lower_back", "traps"] },
  { id: "arms", label: "Arms", muscles: ["biceps", "triceps", "forearms"] },
  { id: "shoulders", label: "Shoulders", muscles: ["shoulders", "traps"] },
  { id: "cardio", label: "Cardio & HIIT", muscles: [] },
];

const CARDIO_IDS = ["jumping-jack", "high-knees", "burpee", "mountain-climber", "jump-squat", "skater-jump", "squat-thrust", "butt-kicks", "jump-rope", "kb-swing", "battle-ropes", "box-jump"];

/** Picks the focus whose muscles are most recovered. */
export function suggestedFocus(s: AppState): Focus {
  if (!s.logs.length) return "full";
  const trained = lastTrained(s);
  const score = (f: (typeof FOCI)[number]) => (f.muscles.length ? f.muscles.reduce((a, m) => a + Math.min(96, trained[m] ?? 96), 0) / f.muscles.length : 0);
  const options = FOCI.filter((f) => ["upper", "lower", "push", "pull", "legs", "full"].includes(f.id));
  return options.sort((a, b) => score(b) - score(a))[0].id;
}

export interface GeneratedWorkout {
  title: string;
  focus: Focus;
  items: ProgramItem[];
  minutes: number;
}

const isCompound = (e: Exercise) => e.muscleGroups.length >= 3;

export function generateWorkout(s: AppState, focus: Focus, minutes: number, seed = Date.now()): GeneratedWorkout {
  let rnd = seed % 2147483647 || 1;
  const rand = () => ((rnd = (rnd * 16807) % 2147483647) - 1) / 2147483646;
  const level = s.profile.level;
  const setsPer = level === "beginner" ? 3 : level === "intermediate" ? 3 : 4;
  const count = Math.max(3, Math.min(9, Math.round(minutes / (level === "advanced" ? 8 : 7))));
  const f = FOCI.find((x) => x.id === focus)!;
  const available = allExercises(s).filter((e) => canDo(e, s));
  const trained = lastTrained(s);

  let pool: { e: Exercise; score: number }[];
  if (focus === "cardio") {
    pool = available.filter((e) => CARDIO_IDS.includes(e.id)).map((e) => ({ e, score: rand() }));
  } else {
    pool = available
      .map((e) => {
        const { primary, secondary } = exerciseMuscles(e.muscleGroups, e.primaryCount);
        const hits = primary.filter((m) => f.muscles.includes(m)).length;
        if (!hits) return null;
        const support = secondary.filter((m) => f.muscles.includes(m)).length * 0.3;
        // Prefer recovered muscles, compound lifts, and equipment the user went out of their way to tick.
        const recovery = primary.reduce((a, m) => a + Math.min(1, (trained[m] ?? 96) / 72), 0) / primary.length;
        const kit = (e.equipmentIds ?? []).length ? 0.4 : 0;
        return { e, score: hits + support + recovery + (isCompound(e) ? 0.8 : 0) + kit + rand() * 0.9 };
      })
      .filter((x): x is { e: Exercise; score: number } => !!x);
  }
  pool.sort((a, b) => b.score - a.score);

  // Spread across muscles and movement patterns.
  const picked: Exercise[] = [];
  const usedMotion = new Set<string>();
  const usedPrimary = new Map<MuscleId, number>();
  for (const { e } of pool) {
    if (picked.length >= count) break;
    const motion = e.motion ?? e.name;
    if (usedMotion.has(motion) && focus !== "cardio") continue;
    const prim = exerciseMuscles(e.muscleGroups, e.primaryCount).primary[0];
    const cap = f.muscles.length <= 2 ? 99 : Math.ceil(count / Math.min(f.muscles.length, count)) + 1;
    if (prim && (usedPrimary.get(prim) ?? 0) >= cap) continue;
    picked.push(e);
    usedMotion.add(motion);
    if (prim) usedPrimary.set(prim, (usedPrimary.get(prim) ?? 0) + 1);
  }
  // Compounds first, then isolation, core and holds last.
  picked.sort((a, b) => Number(isCompound(b)) - Number(isCompound(a)) || Number(a.type === "time") - Number(b.type === "time"));

  const items: ProgramItem[] = picked.map((e) => {
    const prog = progressionFor(s, e.id);
    if (e.type === "time") {
      const base = prog?.nextReps ?? (level === "beginner" ? 30 : level === "intermediate" ? 45 : 60);
      return { exerciseId: e.id, sets: Array(focus === "cardio" ? 3 : setsPer).fill(base), restSec: focus === "cardio" ? 30 : e.defaultRestSec, notes: "" };
    }
    const hardBodyweight = /pull-?up|chin-?up|dip|pistol|nordic|pike|handstand|hanging|muscle-?up/i.test(e.name);
    let reps = e.weighted
      ? isCompound(e)
        ? level === "advanced" ? 6 : 8
        : 12
      : hardBodyweight
        ? level === "beginner" ? 4 : level === "intermediate" ? 6 : 10
        : level === "beginner" ? 8 : level === "intermediate" ? 12 : 15;
    if (focus === "cardio") reps = 15;
    if (!e.weighted && prog?.nextReps) reps = Math.max(reps, prog.nextReps);
    const weight = e.weighted ? prog?.nextWeight ?? lastWeight(s.logs, e.id) : undefined;
    const rest = focus === "cardio" ? 30 : e.weighted && isCompound(e) ? Math.max(90, e.defaultRestSec) : e.defaultRestSec;
    return { exerciseId: e.id, sets: Array(setsPer).fill(reps), restSec: rest, notes: prog?.advice ?? "", ...(weight ? { weights: Array(setsPer).fill(weight) } : {}) };
  });

  return { title: `${f.label} · ${minutes} min`, focus, items, minutes };
}

/** Muscles the coach recommends today, for display. */
export function freshMuscles(s: AppState): MuscleId[] {
  const t = lastTrained(s);
  return (Object.keys(MUSCLE_NAMES) as MuscleId[]).filter((m) => recoveryOf(t[m]) === "fresh");
}

export const todayKey = () => dayKey(new Date());
