import { useState } from "react";
import { AlertTriangle, ExternalLink, RefreshCw, Sparkles } from "lucide-react";
import { exerciseGuidePrompt, openInClaude } from "../lib/claude";
import { fetchGuide } from "../lib/api";
import { historySummary } from "../lib/stats";
import { getState, setState, useAppState } from "../store";
import type { Exercise } from "../types";
import { AIBadge, AILoading } from "./ui";
import { useAIAvailable } from "../hooks";

/** Built-in how-to plus an AI guide personalised to the user's profile and history. */
export function ExerciseGuide({ exercise, compact = false }: { exercise: Exercise; compact?: boolean }) {
  const guide = useAppState().guides[exercise.id];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const aiAvailable = useAIAvailable();

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const s = getState();
      const { guide } = await fetchGuide({
        exercise: { name: exercise.name, type: exercise.type, muscleGroups: exercise.muscleGroups, equipment: exercise.equipment },
        profile: s.profile,
        history: historySummary(s, exercise.id),
      });
      setState((st) => ({ ...st, guides: { ...st.guides, [exercise.id]: { ...guide, generatedAt: Date.now() } } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="col" style={{ gap: 16 }}>
      {!guide && (
        <>
          {exercise.instructions.length > 0 && (
            <div className="col">
              <span className="eyebrow">How to do it</span>
              <ol className="steps">
                {exercise.instructions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
          )}
          {exercise.cues.length > 0 && (
            <div className="col">
              <span className="eyebrow">Cues</span>
              <div className="chips">
                {exercise.cues.map((c) => (
                  <span key={c} className="chip accent">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
          {!compact && exercise.commonMistakes.length > 0 && (
            <div className="col">
              <span className="eyebrow">Avoid</span>
              <ul className="clean muted">
                {exercise.commonMistakes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {loading ? (
        <AILoading messages={["Reviewing your profile…", "Checking your recent sets…", "Writing your coaching notes…"]} />
      ) : guide ? (
        <div className="col" style={{ gap: 16 }}>
          <div className="row between">
            <AIBadge label="PERSONALISED FOR YOU" />
            {aiAvailable && (
              <button className="btn sm ghost" onClick={generate}>
                <RefreshCw size={14} /> Refresh
              </button>
            )}
          </div>
          <p>{guide.summary}</p>
          <div className="card flat" style={{ background: "var(--accent-soft)", borderColor: "transparent" }}>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <Sparkles size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontWeight: 600 }}>{guide.personalizedTip}</p>
            </div>
          </div>
          <Block title="Set up" items={guide.setup} />
          <div className="col">
            <span className="eyebrow">Steps</span>
            <ol className="steps">
              {guide.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
          <div className="col">
            <span className="eyebrow">Cues</span>
            <div className="chips">
              {guide.cues.map((c) => (
                <span key={c} className="chip accent">
                  {c}
                </span>
              ))}
            </div>
          </div>
          <div className="col">
            <span className="eyebrow">Breathing</span>
            <p className="muted">{guide.breathing}</p>
          </div>
          {!compact && <Block title="Common mistakes" items={guide.commonMistakes} />}
          <div className="grid-2">
            <div className="card flat" style={{ padding: 12 }}>
              <span className="eyebrow">Too hard?</span>
              <ul className="clean small" style={{ marginTop: 6 }}>
                {guide.easier.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <div className="card flat" style={{ padding: 12 }}>
              <span className="eyebrow">Too easy?</span>
              <ul className="clean small" style={{ marginTop: 6 }}>
                {guide.harder.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          </div>
          {guide.safety.length > 0 && (
            <div className="banner">
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <div className="col" style={{ gap: 4 }}>
                {guide.safety.map((s) => (
                  <span key={s}>{s}</span>
                ))}
              </div>
            </div>
          )}
          <p className="small faint">Suggested rest: {guide.recommendedRestSec}s between sets</p>
        </div>
      ) : aiAvailable ? (
        <button className="btn block" onClick={generate} style={{ borderColor: "var(--violet)" }}>
          <Sparkles size={16} color="var(--violet)" /> Get AI coaching for your level
        </button>
      ) : (
        <button className="btn block" onClick={() => openInClaude(exerciseGuidePrompt(exercise, getState()))} style={{ borderColor: "var(--violet)" }}>
          <Sparkles size={16} color="var(--violet)" /> Ask Claude to coach me on this <ExternalLink size={14} />
        </button>
      )}
      {error && <div className="banner error">{error}</div>}
    </div>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="col">
      <span className="eyebrow">{title}</span>
      <ul className="clean">
        {items.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </div>
  );
}
