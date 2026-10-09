import type { AIProgram } from "../store";
import type { ChatMessage, ExerciseGuide, GoalPlan } from "../types";

async function request<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error("Can't reach the server. Check your connection and that the app server is running.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body as T;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export async function aiStatus(): Promise<boolean> {
  try {
    const r = await request<{ ai: boolean }>("/api/health", { method: "GET" });
    return r.ai;
  } catch {
    return false;
  }
}

export function importProgram(input: { file?: File; text?: string; notes?: string; profile: unknown }) {
  const form = new FormData();
  if (input.file) form.append("file", input.file);
  if (input.text) form.append("text", input.text);
  if (input.notes) form.append("notes", input.notes);
  form.append("profile", JSON.stringify(input.profile));
  return request<{ program: AIProgram }>("/api/programs/import", { method: "POST", body: form });
}

export function fetchGuide(body: { exercise: unknown; profile: unknown; history: unknown }) {
  return request<{ guide: Omit<ExerciseGuide, "generatedAt"> }>("/api/exercises/instructions", json(body));
}

export function fetchGoalPlan(body: { goal: unknown; profile: unknown; history: unknown }) {
  return request<{ plan: Omit<GoalPlan, "programId"> & { program: AIProgram } }>("/api/goals/plan", json(body));
}

export function coachChat(messages: ChatMessage[], context: string) {
  return request<{ reply: string }>("/api/coach/chat", json({ messages, context }));
}
