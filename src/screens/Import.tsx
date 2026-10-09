import { useRef, useState } from "react";
import { AlertTriangle, FileText, Image as ImageIcon, Play, Sparkles, Upload, X } from "lucide-react";
import { AIBadge, AILoading, Overlay } from "../components/ui";
import { importProgram } from "../lib/api";
import { getState, saveAIProgram, setState, type AIProgram } from "../store";
import { useNav } from "../nav";
import { useAIAvailable } from "../hooks";

const ACCEPT = ".pdf,.docx,.txt,.md,.csv,.json,.html,image/png,image/jpeg,image/webp,image/gif";

export function Import() {
  const nav = useNav();
  const aiAvailable = useAIAvailable();
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [notes, setNotes] = useState("");
  const [drag, setDrag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AIProgram | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function run() {
    setLoading(true);
    setError("");
    try {
      const { program } = await importProgram({ file: file ?? undefined, text: text.trim() || undefined, notes, profile: getState().profile });
      setResult(program);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function save(start: boolean) {
    if (!result) return;
    const id = saveAIProgram(result, "ai-import");
    if (start) setState((s) => ({ ...s, active: { programId: id, completedDayIds: [], startedAt: Date.now() } }));
    nav.replace({ name: "program", id });
  }

  if (loading) {
    return (
      <Overlay title="Importing program">
        <AILoading
          messages={[
            `Reading ${file?.name ?? "your program"}…`,
            "Finding exercises, sets and reps…",
            "Working out rest periods…",
            "Writing exercise instructions…",
            "Laying out your weekly schedule…",
            "Almost there…",
          ]}
        />
        <p className="small faint" style={{ textAlign: "center" }}>
          Long programs can take a minute.
        </p>
      </Overlay>
    );
  }

  if (result) {
    const weeks = [...new Set(result.days.map((d) => d.week))];
    return (
      <Overlay title="Review program">
        <div className="row">
          <AIBadge label="AI IMPORTED" />
        </div>
        <label className="field">
          Program name
          <input className="input" value={result.name} onChange={(e) => setResult({ ...result, name: e.target.value })} />
        </label>
        <p className="muted">{result.description}</p>
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
        <button className="btn ghost block" onClick={() => setResult(null)}>
          Try again
        </button>
      </Overlay>
    );
  }

  return (
    <Overlay title="Import a program">
      <div className="col" style={{ gap: 6 }}>
        <h2 style={{ fontSize: 24, fontWeight: 850 }}>Turn any plan into a tracked challenge</h2>
        <p className="muted">
          Upload a workout plan from a coach, a PDF you downloaded, or a photo of a whiteboard. The AI reads it, adds every exercise with instructions, and builds rep targets and rest timers.
        </p>
      </div>

      {!aiAvailable && (
        <div className="banner">
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>AI isn't configured on the server yet. Add ANTHROPIC_API_KEY to the server's .env file to enable importing.</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      {file ? (
        <div className="card flat row">
          <div className="emoji-badge">{file.type.startsWith("image/") ? <ImageIcon /> : <FileText />}</div>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="ellipsis" style={{ fontWeight: 700 }}>
              {file.name}
            </div>
            <div className="small muted">{(file.size / 1024).toFixed(0)} KB</div>
          </div>
          <button className="icon-btn" onClick={() => setFile(null)} aria-label="Remove file">
            <X size={18} />
          </button>
        </div>
      ) : (
        <div
          className={`dropzone ${drag ? "drag" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) setFile(f);
          }}
          role="button"
          tabIndex={0}
        >
          <div className="emoji-badge" style={{ background: "var(--accent-soft)" }}>
            <Upload color="var(--accent)" />
          </div>
          <div style={{ fontWeight: 750 }}>Tap to upload or drop a file</div>
          <div className="small muted">PDF, Word (.docx), image, text or CSV · up to 25 MB</div>
        </div>
      )}

      <label className="field">
        Or paste the program text
        <textarea className="input" placeholder={"Week 1\nMon: Push-ups 3x10, Squats 3x15, Plank 3x30s\n…"} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <label className="field">
        Anything the AI should know? (optional)
        <input className="input" placeholder="e.g. I can only train 3 days a week, skip running" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      {error && <div className="banner error">{error}</div>}

      <button className="btn primary lg block" disabled={!aiAvailable || (!file && !text.trim())} onClick={run}>
        <Sparkles size={18} /> Build my program
      </button>
    </Overlay>
  );
}
