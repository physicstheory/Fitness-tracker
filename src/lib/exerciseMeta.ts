import type { Exercise, Level } from "../types";

// How hard an exercise is, and which training goals it suits.

export type TrainingGoal = "general" | "aesthetics" | "strength" | "endurance";

export const GOALS: { id: TrainingGoal; label: string; emoji: string; blurb: string }[] = [
  { id: "aesthetics", label: "Aesthetics", emoji: "🪞", blurb: "Build muscle size and shape: moderate weight, 8–12 reps, short rests, plenty of volume." },
  { id: "strength", label: "Strength", emoji: "🏋️", blurb: "Lift heavier: big compound lifts, 3–6 reps, long rests, fewer sets per exercise." },
  { id: "endurance", label: "Endurance", emoji: "🔋", blurb: "Fitness and fat loss: lighter loads, 15–20+ reps, short rests, circuits and cardio." },
  { id: "general", label: "General fitness", emoji: "⚖️", blurb: "A balanced mix of strength, muscle and conditioning." },
];

const HARD_BW = /pull-?up|chin-?up|\bdips?\b|pistol|nordic|handstand|pike|hanging|muscle-?up|archer|one-?arm/i;
const PLYO = /burpee|box jump|jump squat|thruster|snatch|clean|skater|battle rope|squat thrust/i;
const ISOLATION = /curl|raise|extension|kickback|calf|wrist|shrug|crunch|fly|pec deck|abduction|pushdown|face pull|pull-apart|leg curl/i;
const EASY = /knee push|incline push|wall push|walk|bird dog|dead bug|glute bridge|jumping jack|band /i;
const isCardio = (e: Exercise) => /run|bike|row(ing)? machine|treadmill|jump rope|high knees|butt kick|jumping jack|battle rope/i.test(e.name);

/** 1 (easy) to 5 (very hard). */
export function intensityOf(e: Exercise): number {
  let score = 2;
  const compound = e.muscleGroups.length >= 3;
  const equip = e.equipmentIds ?? [];
  if (compound) score += 1;
  if (equip.includes("barbell") && compound) score += 1;
  if (HARD_BW.test(e.name)) score += 2;
  if (PLYO.test(e.name)) score += 1;
  if (ISOLATION.test(e.name)) score -= 1;
  if (EASY.test(e.name)) score -= 1;
  if (/handstand|nordic|pistol/i.test(e.name)) score = 5;
  if (/deadlift|back squat|front squat/i.test(e.name) && !/romanian|kettlebell/i.test(e.name)) score = Math.max(score, 4);
  if (/hollow|dead hang|side plank|flutter/i.test(e.name)) score = 3;
  if (/^plank$|wall sit/i.test(e.name)) score = 2;
  return Math.max(1, Math.min(5, score));
}

export const INTENSITY_LABELS = ["", "Easy", "Moderate", "Challenging", "Hard", "Very hard"];
export const INTENSITY_COLORS = ["", "#2fb67c", "#8bc34a", "#ffb020", "#ff7a2f", "#ff4d5e"];

/** Which goals an exercise is a good fit for. */
export function goalFit(e: Exercise): Record<Exclude<TrainingGoal, "general">, boolean> {
  const compound = e.muscleGroups.length >= 3;
  const heavyKit = (e.equipmentIds ?? []).some((id) => ["barbell", "dumbbells", "kettlebell", "leg_press", "machines", "cable"].includes(id));
  const cardio = isCardio(e);
  return {
    strength: !cardio && e.type === "reps" && ((heavyKit && compound) || HARD_BW.test(e.name) || /deadlift|squat|press|row/i.test(e.name) && heavyKit),
    aesthetics: !cardio && (e.type === "reps" || /plank|hollow/i.test(e.name)),
    endurance: cardio || e.type === "time" || PLYO.test(e.name) || (!heavyKit && !HARD_BW.test(e.name)),
  };
}

export interface Scheme {
  sets: number;
  reps: number;
  /** Shown to the user, e.g. "8–12". */
  range: string;
  rest: number;
}

/** Sets, reps and rest for an exercise under a goal. */
export function schemeFor(e: Exercise, goal: TrainingGoal, level: Level): Scheme {
  const compound = e.muscleGroups.length >= 3;
  const hard = HARD_BW.test(e.name);
  const lvl = level === "beginner" ? 0 : level === "intermediate" ? 1 : 2;
  if (e.type === "time") {
    const secs = goal === "endurance" ? [40, 50, 60][lvl] : goal === "strength" ? [20, 30, 40][lvl] : [30, 40, 50][lvl];
    return { sets: goal === "endurance" ? 3 : 3, reps: secs, range: `${secs}s`, rest: goal === "endurance" ? 30 : 45 };
  }
  if (hard && !e.weighted) {
    const reps = goal === "strength" ? [3, 5, 6][lvl] : goal === "endurance" ? [5, 8, 12][lvl] : [4, 6, 10][lvl];
    return { sets: goal === "strength" ? 5 : 3, reps, range: `${Math.max(1, reps - 2)}–${reps + 2}`, rest: goal === "strength" ? 150 : 90 };
  }
  switch (goal) {
    case "strength":
      return compound ? { sets: 5, reps: 5, range: "3–6", rest: 180 } : { sets: 3, reps: 8, range: "6–8", rest: 120 };
    case "aesthetics":
      return compound ? { sets: 4, reps: 8, range: "6–10", rest: 90 } : { sets: 3, reps: 12, range: "10–15", rest: 60 };
    case "endurance":
      return { sets: 3, reps: e.weighted ? 15 : 20, range: e.weighted ? "15–20" : "20+", rest: 40 };
    default:
      return e.weighted ? { sets: 3, reps: compound ? 8 : 12, range: compound ? "6–10" : "10–12", rest: compound ? 120 : 75 } : { sets: 3, reps: [8, 12, 15][lvl], range: "10–15", rest: e.defaultRestSec };
  }
}
