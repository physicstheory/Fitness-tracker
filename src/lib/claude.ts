import { bestSet, goalProgress, streak } from "./stats";
import { PROGRAM_JSON_SPEC } from "./programFormat";
import { allExercises, findExercise, findProgram } from "../store";
import type { AppState, Exercise, Goal } from "../types";

// Hands questions to the Claude app (covered by the user's Claude subscription) instead of the API.

const CLAUDE_NEW_CHAT = "https://claude.ai/new";
const MAX_URL_PROMPT = 6000;

/** Copies the prompt and opens a new Claude chat with it pre-filled. Returns whether the copy worked. */
export async function openInClaude(prompt: string): Promise<boolean> {
  let copied = false;
  try {
    await navigator.clipboard.writeText(prompt);
    copied = true;
  } catch {
    // Clipboard blocked; the pre-filled message still works.
  }
  const q = prompt.length > MAX_URL_PROMPT ? prompt.slice(0, MAX_URL_PROMPT) : prompt;
  window.open(`${CLAUDE_NEW_CHAT}?q=${encodeURIComponent(q)}`, "_blank", "noopener");
  return copied;
}

/** A short, readable summary of the user's training for Claude. */
export function trainingSummary(s: AppState): string {
  const p = s.profile;
  const program = findProgram(s.active?.programId, s);
  const bests = allExercises(s)
    .map((e) => ({ e, best: bestSet(s.logs, e.id) }))
    .filter((x) => x.best > 0)
    .map((x) => `${x.e.name} ${x.best}${x.e.type === "time" ? "s" : ""}`);
  const lines = [
    `About me: ${p.name || "(no name)"}, ${p.level}${p.age ? `, age ${p.age}` : ""}. Equipment: ${p.equipment || "not specified"}.${p.limitations ? ` Injuries/limitations: ${p.limitations}.` : ""}`,
    `Training: ${s.logs.length} workouts logged, current streak ${streak(s.logs).current} days.`,
    program ? `Current program: ${program.name}, ${s.active!.completedDayIds.length} of ${program.days.length} sessions done. Program goal: ${program.goal}.` : "No current program.",
    bests.length ? `Best single sets: ${bests.join(", ")}.` : "",
    s.goals.length
      ? `Goals: ${s.goals
          .map((g) => `${g.target} ${findExercise(g.exerciseId, s)?.name} (${goalLabel(g)}), currently ${goalProgress(g, s.logs)}${g.deadline ? `, deadline ${g.deadline}` : ""}${g.achievedAt ? " (achieved)" : ""}`)
          .join("; ")}.`
      : "",
    s.logs.length
      ? `Recent workouts:\n${s.logs
          .slice(0, 6)
          .map((l) => `- ${l.date.slice(0, 10)} ${l.title}: ${l.entries.map((e) => `${findExercise(e.exerciseId, s)?.name} ${e.sets.map((x) => x.actual).join("/")}`).join(", ")}`)
          .join("\n")}`
      : "",
    `Today is ${new Date().toDateString()}.`,
  ];
  return lines.filter(Boolean).join("\n");
}

const goalLabel = (g: Goal) => (g.metric === "max_set" ? "in one set" : g.metric === "daily_total" ? "in one day" : "cumulative total");

export function coachPrompt(question: string, s: AppState): string {
  return `You're my fitness coach. I track workouts in an app called RepRise; here's my current data:

${trainingSummary(s)}

My question: ${question}

Keep it practical and specific to my numbers. If I mention pain, tell me to stop and see a professional.`;
}

export function exerciseGuidePrompt(ex: Exercise, s: AppState): string {
  return `Coach me on the ${ex.name} (${ex.type === "time" ? "timed hold" : "rep exercise"}, works ${ex.muscleGroups.join(", ") || "multiple muscles"}).

${trainingSummary(s)}

Give me: set-up, step-by-step technique, 3 cues to remember mid-set, breathing, common mistakes, easier and harder variations, and safety notes for my limitations. Finish with one tip tailored to my level and recent sets.`;
}

export function goalPlanPrompt(goal: Goal, ex: Exercise | undefined, s: AppState): string {
  return `Build me a training program to reach this goal: ${goal.target}${ex?.type === "time" ? " seconds" : ""} ${ex?.name ?? ""} ${goalLabel(goal)}, starting from ${goal.baseline}${goal.deadline ? `, by ${goal.deadline}` : " in about 6 weeks"}.

${trainingSummary(s)}

Make it progressive, Push-Up Challenge style: several sets with rest, the last set often max effort, rest days between sessions, and a test session at the end. Put weekly milestones in "notes".

${PROGRAM_JSON_SPEC}`;
}
