import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import express from "express";
import type Anthropic from "@anthropic-ai/sdk";
import { aiConfigured, chat, describeError, structured } from "./ai.ts";
import { GoalPlanSchema, InstructionsSchema } from "./schemas.ts";

const app = express();
app.use(express.json({ limit: "2mb" }));

function profileText(profile: unknown): string {
  if (!profile || typeof profile !== "object") return "No profile provided.";
  return JSON.stringify(profile, null, 2);
}

const send = (res: express.Response, err: unknown) => {
  const { status, message } = describeError(err);
  if (status >= 500) console.error("[api]", err);
  res.status(status).json({ error: message });
};

const requireAI: express.RequestHandler = (_req, res, next) => {
  if (!aiConfigured()) {
    res.status(503).json({ error: "AI is not configured. Set ANTHROPIC_API_KEY in the server's .env file." });
    return;
  }
  next();
};

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ai: aiConfigured() });
});

// Personalised how-to for one exercise.
app.post("/api/exercises/instructions", requireAI, async (req, res) => {
  try {
    const { exercise, profile, history } = req.body ?? {};
    if (!exercise?.name) {
      res.status(400).json({ error: "exercise.name is required" });
      return;
    }
    const guide = await structured({
      schema: InstructionsSchema,
      effort: "low",
      content: [
        {
          type: "text",
          text: `Write a personalised coaching guide for this exercise.

Exercise: ${JSON.stringify(exercise)}
User profile: ${profileText(profile)}
Recent history for this exercise: ${JSON.stringify(history ?? "none")}`,
        },
      ],
    });
    res.json({ guide });
  } catch (err) {
    send(res, err);
  }
});

// Build a plan (and a full program) to reach a specific goal.
app.post("/api/goals/plan", requireAI, async (req, res) => {
  try {
    const { goal, profile, history } = req.body ?? {};
    if (!goal?.exercise || !goal?.target) {
      res.status(400).json({ error: "goal.exercise and goal.target are required" });
      return;
    }
    const plan = await structured({
      schema: GoalPlanSchema,
      effort: "medium",
      content: [
        {
          type: "text",
          text: `Create a progressive training plan that gets this person to their goal.

Goal: ${JSON.stringify(goal)}
(metric "max_set" = most reps/seconds in one unbroken set; "daily_total" = total reps across a day; "total" = cumulative reps from the start date to the deadline)
User profile: ${profileText(profile)}
Recent training history: ${JSON.stringify(history ?? "none")}

Requirements:
- Start from their current baseline and finish by the deadline (use about 6 weeks if no deadline is set).
- Weekly milestones should be in the goal's own unit and increase steadily.
- The program must list every session (week/day) with concrete set targets, Push-Up Challenge style: several sets with rest, the last set often max effort (0).
- Include a test session at the end of the plan, and accessory exercises where they help.`,
        },
      ],
    });
    res.json({ plan });
  } catch (err) {
    send(res, err);
  }
});

app.post("/api/coach/chat", requireAI, async (req, res) => {
  try {
    const { messages, context } = req.body ?? {};
    if (!Array.isArray(messages) || !messages.length) {
      res.status(400).json({ error: "messages are required" });
      return;
    }
    const clean: Anthropic.Beta.BetaMessageParam[] = messages
      .filter((m: { role?: string; content?: unknown }) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-20)
      .map((m: { role: "user" | "assistant"; content: string }) => ({ role: m.role, content: m.content }));
    while (clean.length && clean[0].role !== "user") clean.shift();
    const reply = await chat(clean, typeof context === "string" ? context : "No context.");
    res.json({ reply });
  } catch (err) {
    send(res, err);
  }
});

// In production, serve the built web app.
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, "../dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => {
  console.log(`RepRise API listening on http://localhost:${port} (AI ${aiConfigured() ? "enabled" : "disabled"})`);
});
