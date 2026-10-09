import { useSyncExternalStore } from "react";
import { BUILTIN_EXERCISES, EXERCISE_EMOJIS } from "./data/exercises";
import { BUILTIN_PROGRAMS, PROGRAM_COLORS } from "./data/programs";
import type { AppState, Exercise, Program, ProgramDay } from "./types";

const KEY = "reprise:v1";

const DEFAULT_STATE: AppState = {
  version: 1,
  profile: { name: "", level: "beginner", limitations: "", equipment: "Bodyweight only" },
  settings: { sound: true, vibrate: true, autoStartRest: true, countdownBeeps: true, dailyRepTarget: 100, autoPlayMusic: true },
  customExercises: [],
  programs: [],
  active: null,
  logs: [],
  goals: [],
  guides: {},
  chat: [],
};

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      ...DEFAULT_STATE,
      ...parsed,
      profile: { ...DEFAULT_STATE.profile, ...parsed.profile },
      settings: { ...DEFAULT_STATE.settings, ...parsed.settings },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

let state: AppState = load();
const listeners = new Set<() => void>();

export function getState(): AppState {
  return state;
}

export function setState(update: (s: AppState) => AppState) {
  state = update(state);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked; keep the in-memory state.
  }
  listeners.forEach((l) => l());
}

export function replaceState(next: AppState) {
  setState(() => ({ ...DEFAULT_STATE, ...next }));
}

export function resetState() {
  setState(() => DEFAULT_STATE);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState);
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function allExercises(s: AppState = state): Exercise[] {
  return [...BUILTIN_EXERCISES, ...s.customExercises];
}

export function allPrograms(s: AppState = state): Program[] {
  return [...s.programs, ...BUILTIN_PROGRAMS];
}

export function findExercise(id: string, s: AppState = state): Exercise | undefined {
  return allExercises(s).find((e) => e.id === id);
}

export function findProgram(id: string | undefined, s: AppState = state): Program | undefined {
  return id ? allPrograms(s).find((p) => p.id === id) : undefined;
}

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Loose name matching so "Push Ups" from a PDF maps to the built-in "Push-Up". */
const norm = (name: string) => slug(name).replace(/-/g, "").replace(/(es|s)$/, "");

/** Shape returned by the server's AI endpoints. */
export interface AIProgram {
  name: string;
  description: string;
  goal: string;
  level: Program["level"];
  durationWeeks: number;
  daysPerWeek: number;
  exercises: Omit<Exercise, "id" | "emoji">[];
  days: { week: number; day: number; title: string; focus: string; items: { exercise: string; sets: number[]; restSec: number; notes: string }[] }[];
  notes: string[];
}

/** Saves an AI-generated program, creating any exercises the app doesn't know yet. Returns the program id. */
export function saveAIProgram(ai: AIProgram, source: Program["source"]): string {
  const programId = `prog-${uid()}`;
  setState((s) => {
    const known = allExercises(s);
    const created: Exercise[] = [];
    const idFor = new Map<string, string>();

    const resolve = (name: string): string => {
      const key = norm(name);
      if (idFor.has(key)) return idFor.get(key)!;
      const existing = known.find((e) => norm(e.name) === key) ?? created.find((e) => norm(e.name) === key);
      if (existing) {
        idFor.set(key, existing.id);
        return existing.id;
      }
      const info = ai.exercises.find((e) => norm(e.name) === key);
      const ex: Exercise = {
        id: `ex-${slug(name) || "exercise"}-${uid().slice(0, 4)}`,
        name: info?.name ?? name,
        type: info?.type ?? "reps",
        muscleGroups: info?.muscleGroups ?? [],
        equipment: info?.equipment ?? "",
        instructions: info?.instructions ?? [],
        cues: info?.cues ?? [],
        commonMistakes: info?.commonMistakes ?? [],
        defaultRestSec: info?.defaultRestSec ?? 60,
        emoji: EXERCISE_EMOJIS[(created.length + s.customExercises.length) % EXERCISE_EMOJIS.length],
      };
      created.push(ex);
      idFor.set(key, ex.id);
      return ex.id;
    };

    ai.exercises.forEach((e) => resolve(e.name));
    const days: ProgramDay[] = [...ai.days]
      .sort((a, b) => a.week - b.week || a.day - b.day)
      .map((d, i) => ({
        id: `${programId}-${i}`,
        week: d.week,
        day: d.day,
        title: d.title,
        focus: d.focus,
        items: d.items
          .filter((it) => it.sets.length)
          .map((it) => ({
            exerciseId: resolve(it.exercise),
            sets: it.sets.map((n) => Math.max(0, Math.round(n))),
            restSec: Math.max(0, Math.round(it.restSec)),
            notes: it.notes,
          })),
      }))
      .filter((d) => d.items.length);

    const program: Program = {
      id: programId,
      name: ai.name,
      description: ai.description,
      goal: ai.goal,
      level: ai.level,
      durationWeeks: ai.durationWeeks,
      daysPerWeek: ai.daysPerWeek,
      notes: ai.notes,
      days,
      source,
      color: PROGRAM_COLORS[s.programs.length % PROGRAM_COLORS.length],
      createdAt: Date.now(),
    };
    return { ...s, customExercises: [...s.customExercises, ...created], programs: [program, ...s.programs] };
  });
  return programId;
}
