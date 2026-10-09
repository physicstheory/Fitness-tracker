import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

let client: Anthropic | null = null;
export function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export class AIError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

const COACH_SYSTEM = `You are Coach, the AI inside a rep-tracking fitness app modelled on the Push-Up Challenge.
You write clear, encouraging, practical guidance for bodyweight and gym training.
Prioritise safe progression: small weekly increases, rest days, and regressions when someone is struggling.
Never diagnose injuries; when someone mentions pain, recommend they stop and see a professional.`;

/**
 * Runs one structured-output request and returns the parsed object.
 * Streams under the hood so large outputs (whole multi-week programs) don't hit HTTP timeouts.
 */
export async function structured<S extends z.ZodType>(opts: {
  schema: S;
  content: Anthropic.Beta.BetaContentBlockParam[];
  effort?: "low" | "medium" | "high";
  system?: string;
}): Promise<z.infer<S>> {
  const stream = getClient().beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: opts.system ?? COACH_SYSTEM,
    output_config: { effort: opts.effort ?? "medium", format: betaZodOutputFormat(opts.schema) },
    messages: [{ role: "user", content: opts.content }],
  });
  const message = await stream.finalMessage();
  checkStop(message);
  if (message.parsed_output == null) throw new AIError("The AI returned a response that could not be read. Please try again.");
  return message.parsed_output as z.infer<S>;
}

export async function chat(messages: Anthropic.Beta.BetaMessageParam[], context: string): Promise<string> {
  const message = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: `${COACH_SYSTEM}
Keep answers short and skimmable (under ~180 words) unless asked for detail. Use plain text with short lists.

What you know about this user (from the app):
${context}`,
    output_config: { effort: "low" },
    messages,
  });
  checkStop(message);
  return message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

function checkStop(message: Anthropic.Beta.BetaMessage) {
  if (message.stop_reason === "refusal") {
    throw new AIError("The AI declined this request. Try rephrasing it or uploading a different file.", 422);
  }
  if (message.stop_reason === "max_tokens") {
    throw new AIError("The response was too long to finish. Try a shorter file or a simpler request.", 422);
  }
}

export function describeError(err: unknown): { status: number; message: string } {
  if (err instanceof AIError) return { status: err.status, message: err.message };
  if (err instanceof Anthropic.AuthenticationError)
    return { status: 500, message: "The server's Anthropic API key is invalid." };
  if (err instanceof Anthropic.RateLimitError)
    return { status: 429, message: "The AI is busy right now. Please wait a moment and try again." };
  if (err instanceof Anthropic.BadRequestError) return { status: 400, message: `AI request rejected: ${err.message}` };
  if (err instanceof Anthropic.APIError) return { status: 502, message: `AI service error (${err.status ?? "network"}).` };
  return { status: 500, message: err instanceof Error ? err.message : "Unexpected error" };
}
