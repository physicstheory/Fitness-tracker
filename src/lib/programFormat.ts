import type { AIProgram } from "../store";

/** The JSON shape RepRise imports, with rules. Shared by every "ask Claude for a program" prompt. */
export const PROGRAM_JSON_SPEC = `Reply with ONLY one \`\`\`json code block, no other text, in exactly this shape:

{
  "app": "reprise",
  "name": "Program name",
  "description": "One or two sentences",
  "goal": "What it builds toward",
  "level": "beginner" | "intermediate" | "advanced",
  "durationWeeks": 4,
  "daysPerWeek": 3,
  "exercises": [
    {
      "name": "Push-Up",
      "type": "reps" or "time",
      "muscleGroups": ["Chest"],
      "equipment": "None",
      "instructions": ["Step 1", "Step 2", "Step 3"],
      "cues": ["Short cue"],
      "commonMistakes": ["Mistake"],
      "defaultRestSec": 60
    }
  ],
  "days": [
    {
      "week": 1,
      "day": 1,
      "title": "Week 1 · Day 1",
      "focus": "Upper body",
      "items": [
        { "exercise": "Push-Up", "sets": [10, 10, 8], "restSec": 60, "notes": "" }
      ]
    }
  ],
  "notes": ["General guidance from the program"]
}

Rules:
- List every session in order. Expand "repeat weeks 1-2" style instructions so each session appears.
- "sets" holds the target for each set: reps for rep exercises, seconds for timed ones. Use 0 for max effort / AMRAP / to failure.
- For ranges like 8-12, use the low end early and progress sensibly.
- Every "exercise" in days must exactly match a name in "exercises".
- Write clear, practical instructions and cues for each exercise.`;

/**
 * Instructions the user sends to Claude (in the Claude app) along with their program file.
 * Claude replies with JSON that the app imports, so no API key is needed.
 */
export const CONVERT_PROMPT = `Convert the workout program in the attached file into JSON for my rep-tracking app (RepRise).

${PROGRAM_JSON_SPEC}`;

const LEVELS = ["beginner", "intermediate", "advanced"] as const;

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v.trim() : fallback);
const num = (v: unknown, fallback: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};
const strList = (v: unknown) => (Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : []);

/** Pulls the JSON object out of whatever the user pasted (code fences, extra text, etc). */
function extractJSON(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0) throw new Error("No program found. Copy Claude's whole reply, including the code block.");
  if (end <= start) throw new Error("Claude's reply looks cut off. Ask Claude to \"send the complete JSON again\" and copy it again.");
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    throw new Error("Claude's reply was cut off or isn't valid JSON. Ask Claude to \"send the complete JSON again\" and copy it again.");
  }
}

/** Validates and normalises a pasted program. Throws a user-facing error if it can't be used. */
export function parseProgram(text: string): AIProgram {
  const raw = extractJSON(text) as Record<string, unknown>;
  if (!raw || typeof raw !== "object") throw new Error("That doesn't look like a program.");

  const exercises = (Array.isArray(raw.exercises) ? raw.exercises : [])
    .map((e: Record<string, unknown>) => ({
      name: str(e?.name),
      type: e?.type === "time" ? ("time" as const) : ("reps" as const),
      muscleGroups: strList(e?.muscleGroups),
      equipment: str(e?.equipment, "None"),
      instructions: strList(e?.instructions),
      cues: strList(e?.cues),
      commonMistakes: strList(e?.commonMistakes),
      defaultRestSec: Math.max(0, Math.round(num(e?.defaultRestSec, 60))),
    }))
    .filter((e) => e.name);

  const days = (Array.isArray(raw.days) ? raw.days : [])
    .map((d: Record<string, unknown>, i: number) => ({
      week: Math.max(1, Math.round(num(d?.week, 1))),
      day: Math.max(1, Math.round(num(d?.day, i + 1))),
      title: str(d?.title, `Session ${i + 1}`),
      focus: str(d?.focus),
      items: (Array.isArray(d?.items) ? d.items : [])
        .map((it: Record<string, unknown>) => ({
          exercise: str(it?.exercise),
          sets: (Array.isArray(it?.sets) ? it.sets : []).map((s: unknown) => Math.max(0, Math.round(num(s, 0)))),
          restSec: Math.max(0, Math.round(num(it?.restSec, 60))),
          notes: str(it?.notes),
        }))
        .filter((it: { exercise: string; sets: number[] }) => it.exercise && it.sets.length),
    }))
    .filter((d) => d.items.length);

  if (!days.length) throw new Error("No workout sessions were found in that reply.");

  // Any exercise used in a session but missing from the list gets a basic entry.
  for (const d of days)
    for (const it of d.items)
      if (!exercises.some((e) => e.name.toLowerCase() === it.exercise.toLowerCase()))
        exercises.push({ name: it.exercise, type: "reps", muscleGroups: [], equipment: "", instructions: [], cues: [], commonMistakes: [], defaultRestSec: it.restSec });

  const weeks = Math.max(...days.map((d) => d.week));
  const level = LEVELS.includes(raw.level as (typeof LEVELS)[number]) ? (raw.level as AIProgram["level"]) : "beginner";
  return {
    name: str(raw.name, "Imported program"),
    description: str(raw.description),
    goal: str(raw.goal, "Follow the program"),
    level,
    durationWeeks: Math.round(num(raw.durationWeeks, weeks)),
    daysPerWeek: Math.round(num(raw.daysPerWeek, Math.ceil(days.length / weeks))),
    exercises,
    days,
    notes: strList(raw.notes),
  };
}
