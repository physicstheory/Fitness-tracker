import type { Program, ProgramDay, ProgramItem } from "../types";

const item = (exerciseId: string, sets: number[], restSec: number, notes = ""): ProgramItem => ({
  exerciseId,
  sets,
  restSec,
  notes,
});

function weeks(programId: string, plan: { title: string; focus: string; items: ProgramItem[] }[][]): ProgramDay[] {
  return plan.flatMap((week, w) =>
    week.map((d, i) => ({ id: `${programId}-w${w + 1}d${i + 1}`, week: w + 1, day: i + 1, ...d })),
  );
}

// Classic "one hundred push-ups" progression, beginner column.
const pushUpSets = [
  [[2, 3, 2, 2, 3], [3, 4, 2, 3, 4], [4, 5, 4, 4, 5]],
  [[4, 6, 4, 4, 6], [5, 6, 4, 4, 7], [5, 7, 5, 5, 8]],
  [[10, 12, 7, 7, 9], [10, 12, 8, 8, 12], [11, 15, 9, 9, 13]],
  [[12, 14, 11, 10, 16], [14, 16, 12, 12, 18], [16, 18, 13, 13, 20]],
  [[17, 19, 15, 15, 20], [10, 10, 13, 13, 10, 10, 9, 25], [13, 13, 15, 15, 12, 12, 10, 30]],
  [[25, 30, 20, 15, 40], [14, 14, 15, 15, 14, 14, 10, 10, 44], [13, 13, 17, 17, 16, 16, 14, 14, 50]],
];
const pushRest = [60, 60, 75, 90, 90, 90];

const PUSH_UP_CHALLENGE: Program = {
  id: "builtin-100-pushups",
  name: "100 Push-Up Challenge",
  description:
    "The classic six-week progression. Three sessions a week of five to nine sets, with the last set of each session taken to your max.",
  goal: "100 consecutive push-ups",
  level: "beginner",
  durationWeeks: 7,
  daysPerWeek: 3,
  source: "builtin",
  color: "#ff5a36",
  createdAt: 0,
  notes: [
    "Rest at least one day between sessions.",
    "The final set is a minimum: keep going until you can't do another clean rep.",
    "If you can't complete a week, repeat it before moving on.",
    "Use knee push-ups for any set you can't finish on your toes.",
  ],
  days: [
    ...weeks(
      "builtin-100-pushups",
      pushUpSets.map((week, w) =>
        week.map((sets, d) => ({
          title: `Week ${w + 1} · Day ${d + 1}`,
          focus: `${sets.reduce((a, b) => a + b, 0)}+ push-ups across ${sets.length} sets`,
          items: [item("push-up", sets, pushRest[w], `Last set: at least ${sets[sets.length - 1]}, then keep going to max.`)],
        })),
      ),
    ),
    {
      id: "builtin-100-pushups-test",
      week: 7,
      day: 1,
      title: "Final Test",
      focus: "One set, as many push-ups as you can. Go for 100!",
      items: [item("push-up", [0], 0, "Max effort. Strict form, rest at the top if needed.")],
    },
  ],
};

const squatSets = [
  [[10, 10, 8, 8], [12, 10, 10, 8], [12, 12, 10, 10]],
  [[15, 12, 12, 10], [15, 15, 12, 12], [18, 15, 15, 12]],
  [[20, 18, 15, 15], [20, 20, 18, 15], [22, 20, 20, 18]],
  [[25, 22, 20, 20], [25, 25, 22, 20], [30, 25, 25, 0]],
];

const SQUAT_CHALLENGE: Program = {
  id: "builtin-squat",
  name: "Squat Challenge",
  description: "Four weeks of high-rep bodyweight squats to build leg endurance, finishing with a max set.",
  goal: "100 squats in a session with ease",
  level: "beginner",
  durationWeeks: 4,
  daysPerWeek: 3,
  source: "builtin",
  color: "#2fb67c",
  createdAt: 0,
  notes: ["Full depth every rep: thighs at least parallel.", "Add a wall sit on rest days if you want extra work."],
  days: weeks(
    "builtin-squat",
    squatSets.map((week, w) =>
      week.map((sets, d) => ({
        title: `Week ${w + 1} · Day ${d + 1}`,
        focus: "Leg endurance",
        items: [item("squat", sets, 60), ...(d === 2 ? [item("wall-sit", [30 + w * 15], 45)] : [])],
      })),
    ),
  ),
};

const PLANK_BUILDER: Program = {
  id: "builtin-plank",
  name: "Plank Builder",
  description: "Build to a rock-solid 3-minute plank with short, frequent holds.",
  goal: "3-minute plank",
  level: "beginner",
  durationWeeks: 4,
  daysPerWeek: 3,
  source: "builtin",
  color: "#7c5cff",
  createdAt: 0,
  notes: ["Stop a hold early if your hips sag. Quality beats time."],
  days: weeks(
    "builtin-plank",
    [0, 1, 2, 3].map((w) =>
      [0, 1, 2].map((d) => {
        const base = 20 + w * 20 + d * 5;
        return {
          title: `Week ${w + 1} · Day ${d + 1}`,
          focus: `${base}s holds`,
          items: [item("plank", [base, base, Math.round(base * 0.8), w === 3 && d === 2 ? 0 : base], 45)],
        };
      }),
    ),
  ),
};

const FULL_BODY: Program = {
  id: "builtin-fullbody",
  name: "Full Body Starter",
  description: "A balanced four-week bodyweight routine: push, legs, core and conditioning.",
  goal: "General strength and fitness",
  level: "beginner",
  durationWeeks: 4,
  daysPerWeek: 3,
  source: "builtin",
  color: "#1e9bff",
  createdAt: 0,
  notes: ["Move through the circuit in order.", "Increase reps each week only if form stays clean."],
  days: weeks(
    "builtin-fullbody",
    [0, 1, 2, 3].map((w) =>
      [0, 1, 2].map((d) => ({
        title: `Week ${w + 1} · Day ${d + 1}`,
        focus: ["Strength", "Endurance", "Conditioning"][d],
        items: [
          item("push-up", [6 + w * 2, 6 + w * 2, 5 + w * 2], 60),
          item("squat", [12 + w * 3, 12 + w * 3, 10 + w * 3], 60),
          item("lunge", [10 + w * 2, 10 + w * 2], 45),
          d === 2 ? item("burpee", [6 + w * 2, 6 + w * 2], 60) : item("sit-up", [12 + w * 3, 12 + w * 3], 45),
          item("plank", [30 + w * 10, 30 + w * 10], 30),
        ],
      })),
    ),
  ),
};

export const BUILTIN_PROGRAMS: Program[] = [PUSH_UP_CHALLENGE, SQUAT_CHALLENGE, PLANK_BUILDER, FULL_BODY];

export const PROGRAM_COLORS = ["#ff5a36", "#2fb67c", "#7c5cff", "#1e9bff", "#ff9f1c", "#e83f8b", "#14b8a6"];
