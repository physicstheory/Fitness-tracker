import { useEffect, useRef, useState } from "react";
import { ClipboardCopy, ExternalLink, RotateCcw, Send, Sparkles } from "lucide-react";
import { AIBadge } from "../components/ui";
import { coachChat } from "../lib/api";
import { coachPrompt, openInClaude, trainingSummary } from "../lib/claude";
import { getState, setState, useAppState } from "../store";
import { useAIAvailable } from "../hooks";
import type { ChatMessage } from "../types";

const SUGGESTIONS = [
  "How do I break through a push-up plateau?",
  "What should I do on rest days?",
  "Is my current plan on track for my goal?",
  "My wrists hurt during push-ups. Any alternatives?",
  "Give me a 10-minute workout for today",
];

export function Coach() {
  const aiAvailable = useAIAvailable();
  return aiAvailable ? <InAppCoach /> : <ClaudeAppCoach />;
}

/** Without an API key: questions open in the Claude app with the user's training data attached. */
function ClaudeAppCoach() {
  const state = useAppState();
  const [input, setInput] = useState("");
  const [note, setNote] = useState("");

  async function ask(question: string) {
    const q = question.trim();
    if (!q) return;
    const copied = await openInClaude(coachPrompt(q, getState()));
    setState((s) => ({ ...s, chat: [...s.chat.filter((m) => m.content !== q), { role: "user" as const, content: q }].slice(-8) }));
    setInput("");
    setNote(copied ? "Opened in Claude. If the message box is empty, paste — your question and training data are copied." : "Opened in Claude with your question and training data.");
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(`My training data from RepRise:\n\n${trainingSummary(getState())}`);
      setNote("Training summary copied. Paste it into any Claude chat or Project.");
    } catch {
      setNote("Couldn't copy. Your browser blocked the clipboard.");
    }
  }

  const recent = [...state.chat].filter((m) => m.role === "user").reverse();

  return (
    <div className="screen" style={{ paddingBottom: "calc(var(--nav-h) + var(--safe-b) + 90px)" }}>
      <div className="screen-header">
        <div className="col" style={{ gap: 4 }}>
          <h1>Coach</h1>
          <AIBadge label="POWERED BY YOUR CLAUDE APP" />
        </div>
      </div>

      <div className="card col" style={{ gap: 8 }}>
        <Sparkles color="var(--violet)" />
        <p style={{ fontWeight: 700 }}>Ask anything{state.profile.name ? `, ${state.profile.name}` : ""}.</p>
        <p className="small muted">
          Your question opens in the Claude app along with your workouts, personal bests, goals and current program, so the answer is about you. It uses your Claude subscription, no API key needed.
        </p>
        <button className="btn sm ghost" style={{ alignSelf: "flex-start" }} onClick={copySummary}>
          <ClipboardCopy size={14} /> Copy my training summary
        </button>
      </div>

      {note && <div className="banner" style={{ color: "var(--good)", background: "var(--good-soft)" }}>{note}</div>}

      <span className="eyebrow">Try asking</span>
      <div className="col" style={{ gap: 8 }}>
        {SUGGESTIONS.map((s) => (
          <button key={s} className="card tap row small" style={{ padding: "12px 14px", fontWeight: 600 }} onClick={() => ask(s)}>
            <span className="grow">{s}</span>
            <ExternalLink size={14} className="faint" />
          </button>
        ))}
      </div>

      {recent.length > 0 && (
        <>
          <span className="eyebrow">Recent questions</span>
          <div className="card flat list" style={{ padding: "4px 16px" }}>
            {recent.map((m, i) => (
              <button key={i} className="list-item small" onClick={() => ask(m.content)}>
                <span className="grow">{m.content}</span>
                <ExternalLink size={14} className="faint" />
              </button>
            ))}
          </div>
        </>
      )}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <input className="input" placeholder="Ask your coach…" value={input} onChange={(e) => setInput(e.target.value)} enterKeyHint="send" />
        <button className="btn primary" style={{ width: 52, padding: 0 }} disabled={!input.trim()} aria-label="Ask in Claude">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}

/** With an API key on the server: chat right inside the app. */
function InAppCoach() {
  const state = useAppState();
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
      const { reply } = await coachChat(next, trainingSummary(getState()));
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

      {messages.length === 0 && (
        <div className="col" style={{ gap: 10 }}>
          <div className="card col" style={{ gap: 8 }}>
            <Sparkles color="var(--violet)" />
            <p style={{ fontWeight: 700 }}>Hi{state.profile.name ? ` ${state.profile.name}` : ""}! I can see your workouts, goals and program.</p>
            <p className="small muted">Ask me about form, plateaus, recovery, or how to adjust your plan.</p>
          </div>
          {SUGGESTIONS.map((s) => (
            <button key={s} className="card tap small" style={{ padding: "12px 14px", fontWeight: 600 }} onClick={() => send(s)}>
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
        {error && (
          <div className="banner error col" style={{ alignItems: "flex-start", gap: 8 }}>
            <span>{error}</span>
            <button className="btn sm" onClick={() => openInClaude(coachPrompt(messages.filter((m) => m.role === "user").at(-1)?.content ?? "", getState()))}>
              <ExternalLink size={14} /> Ask in the Claude app instead
            </button>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input className="input" placeholder="Ask your coach…" value={input} onChange={(e) => setInput(e.target.value)} enterKeyHint="send" />
        <button className="btn primary" style={{ width: 52, padding: 0 }} disabled={!input.trim() || loading} aria-label="Send">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
