import { useEffect, useRef, useState } from "react";
import { AlertTriangle, RotateCcw, Send, Sparkles } from "lucide-react";
import { AIBadge } from "../components/ui";
import { coachChat } from "../lib/api";
import { bestSet, goalProgress, streak } from "../lib/stats";
import { allExercises, findExercise, findProgram, getState, setState, useAppState } from "../store";
import { useAIAvailable } from "../hooks";
import type { AppState, ChatMessage } from "../types";

const SUGGESTIONS = [
  "How do I break through a push-up plateau?",
  "What should I do on rest days?",
  "Is my current plan on track for my goal?",
  "My wrists hurt during push-ups. Any alternatives?",
  "Give me a 10-minute workout for today",
];

function buildContext(s: AppState): string {
  const program = findProgram(s.active?.programId, s);
  const trained = allExercises(s)
    .map((e) => ({ e, best: bestSet(s.logs, e.id) }))
    .filter((x) => x.best > 0)
    .map((x) => `${x.e.name}: best set ${x.best}${x.e.type === "time" ? "s" : ""}`);
  return [
    `Profile: ${JSON.stringify(s.profile)}`,
    `Workouts logged: ${s.logs.length}; current streak ${streak(s.logs).current} days.`,
    program ? `Active program: ${program.name} (${s.active!.completedDayIds.length}/${program.days.length} sessions done). Goal: ${program.goal}.` : "No active program.",
    trained.length ? `Personal bests: ${trained.join("; ")}` : "No personal bests yet.",
    s.goals.length
      ? `Goals: ${s.goals
          .map((g) => `${g.target} ${findExercise(g.exerciseId, s)?.name} (${g.metric}), now ${goalProgress(g, s.logs)}${g.deadline ? `, due ${g.deadline}` : ""}${g.achievedAt ? ", ACHIEVED" : ""}`)
          .join("; ")}`
      : "No goals set.",
    `Last workouts: ${s.logs
      .slice(0, 5)
      .map((l) => `${l.date.slice(0, 10)} ${l.title}: ${l.entries.map((e) => `${findExercise(e.exerciseId, s)?.name} ${e.sets.map((x) => x.actual).join("/")}`).join(", ")}`)
      .join(" | ") || "none"}`,
    `Today: ${new Date().toDateString()}`,
  ].join("\n");
}

export function Coach() {
  const state = useAppState();
  const aiAvailable = useAIAvailable();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const messages = state.chat;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const next: ChatMessage[] = [...getState().chat, { role: "user", content }];
    setState((s) => ({ ...s, chat: next }));
    setInput("");
    setLoading(true);
    setError("");
    try {
      const { reply } = await coachChat(next, buildContext(getState()));
      setState((s) => ({ ...s, chat: [...s.chat, { role: "assistant", content: reply }] }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="screen" style={{ paddingBottom: "calc(var(--nav-h) + var(--safe-b) + 90px)" }}>
      <div className="screen-header">
        <div className="col" style={{ gap: 4 }}>
          <h1>Coach</h1>
          <AIBadge label="KNOWS YOUR TRAINING" />
        </div>
        {messages.length > 0 && (
          <button className="icon-btn" onClick={() => setState((s) => ({ ...s, chat: [] }))} aria-label="Clear chat">
            <RotateCcw size={18} />
          </button>
        )}
      </div>

      {!aiAvailable && (
        <div className="banner">
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>The coach needs ANTHROPIC_API_KEY set on the server.</span>
        </div>
      )}

      {messages.length === 0 && (
        <div className="col" style={{ gap: 10 }}>
          <div className="card col" style={{ gap: 8 }}>
            <Sparkles color="var(--violet)" />
            <p style={{ fontWeight: 700 }}>Hi{state.profile.name ? ` ${state.profile.name}` : ""}! I can see your workouts, goals and program.</p>
            <p className="small muted">Ask me about form, plateaus, recovery, or how to adjust your plan.</p>
          </div>
          {SUGGESTIONS.map((s) => (
            <button key={s} className="card tap small" style={{ padding: "12px 14px", fontWeight: 600 }} onClick={() => send(s)} disabled={!aiAvailable}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="col" style={{ gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="bubble assistant row" style={{ gap: 8 }}>
            <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, color: "var(--violet)" }} /> Thinking…
          </div>
        )}
        {error && <div className="banner error">{error}</div>}
        <div ref={endRef} />
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input className="input" placeholder="Ask your coach…" value={input} onChange={(e) => setInput(e.target.value)} disabled={!aiAvailable} />
        <button className="btn primary" style={{ width: 52, padding: 0 }} disabled={!input.trim() || loading || !aiAvailable} aria-label="Send">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
