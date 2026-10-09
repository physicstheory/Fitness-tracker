import { useEffect, useState } from "react";
import { Check, ClipboardPaste, Copy, ExternalLink, Play } from "lucide-react";
import { Overlay } from "../components/ui";
import { CONVERT_PROMPT, parseProgram } from "../lib/programFormat";
import { saveAIProgram, setState, type AIProgram } from "../store";
import { useNav } from "../nav";

const CLAUDE_URL = `https://claude.ai/new?q=${encodeURIComponent(CONVERT_PROMPT)}`;

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function Import({ pasteOnly = false }: { pasteOnly?: boolean }) {
  const nav = useNav();
  const [opened, setOpened] = useState(false);
  const [copied, setCopied] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<AIProgram | null>(null);

  // Coming back from the Claude app: bring the paste step into view.
  useEffect(() => {
    if (!opened) return;
    const onVis = () => document.visibilityState === "visible" && document.getElementById("paste-step")?.scrollIntoView({ behavior: "smooth" });
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [opened]);

  function tryParse(value: string) {
    setText(value);
    if (!value.trim()) return setError("");
    try {
      setResult(parseProgram(value));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function openClaude() {
    // Copy too, in case the Claude app doesn't pick up the pre-filled message.
    setCopied(await copy(CONVERT_PROMPT));
    window.open(CLAUDE_URL, "_blank", "noopener");
    setOpened(true);
  }

  async function pasteFromClipboard() {
    try {
      tryParse(await navigator.clipboard.readText());
    } catch {
      setError("Your browser blocked clipboard access. Long-press the box below and choose Paste.");
    }
  }

  function save(start: boolean) {
    if (!result) return;
    const id = saveAIProgram(result, "ai-import");
    if (start) setState((s) => ({ ...s, active: { programId: id, completedDayIds: [], startedAt: Date.now() } }));
    nav.replace({ name: "program", id });
  }

  if (result) {
    const weeks = [...new Set(result.days.map((d) => d.week))];
    return (
      <Overlay title="Review program" onClose={() => setResult(null)}>
        <div className="row">
          <span className="chip good">
            <Check size={13} /> Converted by Claude
          </span>
        </div>
        <label className="field">
          Program name
          <input className="input" value={result.name} onChange={(e) => setResult({ ...result, name: e.target.value })} />
        </label>
        {result.description && <p className="muted">{result.description}</p>}
        <div className="grid-3">
          <div className="stat">
            <span className="value num">{result.durationWeeks}</span>
            <span className="label">Weeks</span>
          </div>
          <div className="stat">
            <span className="value num">{result.days.length}</span>
            <span className="label">Sessions</span>
          </div>
          <div className="stat">
            <span className="value num">{result.exercises.length}</span>
            <span className="label">Exercises</span>
          </div>
        </div>
        <div className="card flat col">
          <span className="eyebrow">Goal</span>
          <p style={{ fontWeight: 650 }}>{result.goal}</p>
        </div>
        <div className="col">
          <span className="eyebrow">Exercises found</span>
          <div className="chips">
            {result.exercises.map((e) => (
              <span key={e.name} className="chip">
                {e.name} {e.type === "time" ? "⏱" : ""}
              </span>
            ))}
          </div>
        </div>
        {weeks.slice(0, 2).map((w) => (
          <div key={w} className="col">
            <span className="eyebrow">Week {w}</span>
            <div className="card flat list" style={{ padding: "4px 16px" }}>
              {result.days
                .filter((d) => d.week === w)
                .map((d, i) => (
                  <div key={i} className="list-item">
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{d.title}</div>
                      <div className="small muted">
                        {d.items.map((it) => `${it.exercise} ${it.sets.map((s) => (s === 0 ? "MAX" : s)).join("-")}`).join(" · ")}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
        {weeks.length > 2 && <p className="small faint">+ {weeks.length - 2} more weeks</p>}
        {result.notes.length > 0 && (
          <div className="card flat col">
            <span className="eyebrow">Notes</span>
            <ul className="clean small">
              {result.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        )}
        <button className="btn primary lg block" onClick={() => save(true)}>
          <Play size={18} fill="#fff" /> Save & start program
        </button>
        <button className="btn block" onClick={() => save(false)}>
          Save to my programs
        </button>
      </Overlay>
    );
  }

  return (
    <Overlay title={pasteOnly ? "Add Claude's plan" : "Add a program"}>
      {pasteOnly ? (
        <div className="col" style={{ gap: 6 }}>
          <h2 style={{ fontSize: 24, fontWeight: 850 }}>Paste Claude's plan</h2>
          <p className="muted">Claude is writing your plan in the Claude app. When it's done, tap Copy on its code block, come back here and paste.</p>
        </div>
      ) : (
        <>
      <div className="col" style={{ gap: 6 }}>
        <h2 style={{ fontSize: 24, fontWeight: 850 }}>Convert any plan with Claude</h2>
        <p className="muted">Claude reads your program file in the Claude app (included with your subscription) and RepRise turns its reply into a tracked plan with rep targets and rest timers.</p>
      </div>

      <Step n={1} title="Send your program to Claude">
        <p className="small muted">Opens a new Claude chat with the instructions already written. In Claude:</p>
        <ul className="clean small">
          <li>
            Tap the <b>ghost icon</b> to make it an incognito chat (optional)
          </li>
          <li>
            Tap <b>+</b> and attach your program file or photo
          </li>
          <li>Send</li>
        </ul>
        <button className="btn primary block" onClick={openClaude}>
          <ExternalLink size={17} /> Open Claude
        </button>
        {opened && (
          <p className="small faint">
            {copied ? "Instructions also copied. If Claude's message box is empty, paste them in." : "If Claude's message box is empty, use Copy instructions below."}
          </p>
        )}
        <button className="btn sm ghost" onClick={async () => setCopied(await copy(CONVERT_PROMPT))}>
          <Copy size={14} /> {copied ? "Copied" : "Copy instructions"}
        </button>
      </Step>

      <Step n={2} title="Copy Claude's reply">
        <p className="small muted">
          When Claude finishes, tap <b>Copy</b> on its code block and come back here.
        </p>
      </Step>

        </>
      )}

      <div id="paste-step">
        <Step n={pasteOnly ? 1 : 3} title="Paste it into RepRise">
          <button className="btn primary block" onClick={pasteFromClipboard}>
            <ClipboardPaste size={17} /> Paste from Claude
          </button>
          <textarea className="input" placeholder="…or long-press here and paste" value={text} onChange={(e) => tryParse(e.target.value)} style={{ minHeight: 70 }} />
          {error && <div className="banner error">{error}</div>}
        </Step>
      </div>
    </Overlay>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="card col" style={{ gap: 10 }}>
      <div className="row">
        <span className="check-dot next" style={{ fontWeight: 800, fontSize: 13 }}>
          {n}
        </span>
        <h3 style={{ fontSize: 17 }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}
