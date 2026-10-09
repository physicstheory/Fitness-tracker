export type ExerciseType = "reps" | "time";
export type Level = "beginner" | "intermediate" | "advanced";

export interface Exercise {
  id: string;
  name: string;
  type: ExerciseType;
  muscleGroups: string[];
  equipment: string;
  instructions: string[];
  cues: string[];
  commonMistakes: string[];
  defaultRestSec: number;
  emoji: string;
  /** How many of the first muscleGroups are primary movers (default 1). */
  primaryCount?: number;
  /** Form animation id (see lib/motions); inferred from the name when missing. */
  motion?: string;
  /** Equipment ids needed (see data/equipment). Empty = bodyweight. */
  equipmentIds?: string[];
  /** Log a weight with each set. */
  weighted?: boolean;
}

export interface ProgramItem {
  exerciseId: string;
  /** Target per set (reps or seconds). 0 = max effort. */
  sets: number[];
  restSec: number;
  notes: string;
  /** Optional target weight per set, in the user's units. */
  weights?: number[];
}

export interface ProgramDay {
  id: string;
  week: number;
  day: number;
  title: string;
  focus: string;
  items: ProgramItem[];
}

export interface Program {
  id: string;
  name: string;
  description: string;
  goal: string;
  level: Level;
  durationWeeks: number;
  daysPerWeek: number;
  days: ProgramDay[];
  notes: string[];
  source: "builtin" | "ai-import" | "ai-goal";
  color: string;
  createdAt: number;
}

export interface SetLog {
  target: number;
  actual: number;
  /** Load used, in the units chosen at the time. */
  weight?: number;
  unit?: "kg" | "lb";
}

export interface ExerciseLog {
  exerciseId: string;
  sets: SetLog[];
}

export interface WorkoutLog {
  id: string;
  date: string; // ISO timestamp
  programId?: string;
  dayId?: string;
  title: string;
  durationSec: number;
  entries: ExerciseLog[];
  feeling?: 1 | 2 | 3 | 4 | 5;
}

export type GoalMetric = "max_set" | "daily_total" | "total";

export interface GoalPlan {
  summary: string;
  feasibility: "very_achievable" | "achievable" | "ambitious" | "unrealistic";
  feasibilityNote: string;
  weeklyMilestones: { week: number; target: number; description: string }[];
  tips: string[];
  programId?: string;
}

export interface Goal {
  id: string;
  exerciseId: string;
  metric: GoalMetric;
  target: number;
  baseline: number;
  deadline?: string; // yyyy-mm-dd
  createdAt: number;
  plan?: GoalPlan;
  achievedAt?: number;
}

export interface ExerciseGuide {
  summary: string;
  setup: string[];
  steps: string[];
  cues: string[];
  breathing: string;
  commonMistakes: string[];
  easier: string[];
  harder: string[];
  safety: string[];
  recommendedRestSec: number;
  personalizedTip: string;
  generatedAt: number;
}

export interface Profile {
  name: string;
  level: Level;
  age?: number;
  limitations: string;
  equipment: string;
  /** Structured equipment the user owns (ids from data/equipment). */
  equipmentList: string[];
}

export interface Settings {
  sound: boolean;
  vibrate: boolean;
  autoStartRest: boolean;
  countdownBeeps: boolean;
  dailyRepTarget: number;
  /** Spotify app Client ID, if not provided at build time via VITE_SPOTIFY_CLIENT_ID. */
  spotifyClientId?: string;
  workoutMusic?: { uri: string; name: string; image?: string };
  autoPlayMusic: boolean;
  theme: "system" | "light" | "dark";
  /** How reps are counted: tapping, or automatically at a set pace. */
  repMode: "manual" | "auto";
  /** Auto pace source: the user's average tap speed per exercise, or a fixed pace. */
  autoPace: "average" | "fixed";
  autoPaceSec: number;
  units: "kg" | "lb";
}

/** A workout that was paused and saved to finish later. */
export interface SavedWorkout {
  programId?: string;
  dayId?: string;
  exerciseId?: string;
  title: string;
  items: ProgramItem[];
  results: (number | null)[][];
  weights?: (number | null)[][];
  pos: { i: number; s: number };
  phase: "active" | "rest" | "summary";
  count: number;
  elapsedMs: number;
  restLeftMs: number;
  restTotal: number;
  savedAt: number;
}

export interface ActiveProgram {
  programId: string;
  completedDayIds: string[];
  startedAt: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AppState {
  version: 1;
  profile: Profile;
  settings: Settings;
  customExercises: Exercise[];
  programs: Program[];
  active: ActiveProgram | null;
  logs: WorkoutLog[];
  goals: Goal[];
  guides: Record<string, ExerciseGuide>;
  chat: ChatMessage[];
  /** Average seconds per rep for each exercise, learned from manual counting. */
  repPace: Record<string, number>;
  inProgress?: SavedWorkout;
}
