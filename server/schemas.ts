import { z } from "zod";

// Schemas the model must fill. Keep them in sync with the client types in src/types.ts.

export const ExerciseSchema = z.object({
  name: z.string().describe("Short, common exercise name, e.g. 'Push-Up' or 'Plank'"),
  type: z.enum(["reps", "time"]).describe("'reps' if counted in repetitions, 'time' if held/performed for seconds"),
  muscleGroups: z.array(z.string()),
  equipment: z.string().describe("Equipment needed, or 'None'"),
  instructions: z.array(z.string()).describe("Step-by-step instructions, 3-6 steps"),
  cues: z.array(z.string()).describe("Short coaching cues, 2-4"),
  commonMistakes: z.array(z.string()),
  defaultRestSec: z.number().describe("Recommended rest between sets in seconds"),
});

export const ProgramDaySchema = z.object({
  week: z.number().describe("1-based week number"),
  day: z.number().describe("1-based day number within the week"),
  title: z.string(),
  focus: z.string().describe("One-line description of the session focus"),
  items: z.array(
    z.object({
      exercise: z.string().describe("Must exactly match a name in the exercises list"),
      sets: z
        .array(z.number())
        .describe("Target per set: reps for rep exercises, seconds for timed ones. Use 0 for a max-effort / AMRAP set."),
      restSec: z.number().describe("Rest after each set in seconds"),
      notes: z.string().describe("Tempo, load or form notes; empty string if none"),
    }),
  ),
});

export const ProgramSchema = z.object({
  name: z.string(),
  description: z.string(),
  goal: z.string().describe("What the program builds toward, e.g. '100 consecutive push-ups'"),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  durationWeeks: z.number(),
  daysPerWeek: z.number(),
  exercises: z.array(ExerciseSchema),
  days: z.array(ProgramDaySchema).describe("Every scheduled session in order"),
  notes: z.array(z.string()).describe("General guidance from the program, e.g. progression or deload rules"),
});

export const InstructionsSchema = z.object({
  summary: z.string().describe("One or two sentences on what the exercise trains and why it helps this person"),
  setup: z.array(z.string()),
  steps: z.array(z.string()),
  cues: z.array(z.string()).describe("Short, punchy cues to remember mid-set"),
  breathing: z.string(),
  commonMistakes: z.array(z.string()),
  easier: z.array(z.string()).describe("Regressions if the person cannot hit their target"),
  harder: z.array(z.string()).describe("Progressions once the target is easy"),
  safety: z.array(z.string()).describe("Safety notes, especially around the person's stated limitations"),
  recommendedRestSec: z.number(),
  personalizedTip: z.string().describe("One tip tailored to this person's level, history and goal"),
});

export const GoalPlanSchema = z.object({
  summary: z.string(),
  feasibility: z.enum(["very_achievable", "achievable", "ambitious", "unrealistic"]),
  feasibilityNote: z.string().describe("Why, and what a realistic alternative is if it is unrealistic"),
  weeklyMilestones: z.array(
    z.object({
      week: z.number(),
      target: z.number().describe("Target value for the goal metric by the end of this week"),
      description: z.string(),
    }),
  ),
  tips: z.array(z.string()),
  program: ProgramSchema,
});

export type ProgramOut = z.infer<typeof ProgramSchema>;
