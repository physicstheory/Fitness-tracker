import { getState, type AIProgram } from "../store";
import { isNative } from "./native";
import type { ChatMessage, ExerciseGuide, GoalPlan } from "../types";

/** Where the AI server lives. The web app uses its own origin; the iOS app needs a full URL. */
export function apiBase(): string {
  const fromSettings = getState().settings.serverUrl?.trim();
  const base = fromSettings || (import.meta.env.VITE_API_BASE as string | undefined) || "";
  return base.replace(/\/+$/, "");
}

async function request<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response;
  if (isNative && !apiBase()) throw new Error("No AI server set. Add one in Settings, or use the Claude app buttons.");
  try {
    res = await fetch(apiBase() + url, init);
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

export function fetchGuide(body: { exercise: unknown; profile: unknown; history: unknown }) {
  return request<{ guide: Omit<ExerciseGuide, "generatedAt"> }>("/api/exercises/instructions", json(body));
}

export function fetchGoalPlan(body: { goal: unknown; profile: unknown; history: unknown }) {
  return request<{ plan: Omit<GoalPlan, "programId"> & { program: AIProgram } }>("/api/goals/plan", json(body));
}

export function coachChat(messages: ChatMessage[], context: string) {
  return request<{ reply: string }>("/api/coach/chat", json({ messages, context }));
}
