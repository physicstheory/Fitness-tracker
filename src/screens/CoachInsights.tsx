import { useMemo, type ReactNode } from "react";
import { MessageCircle, Sparkles, TrendingDown, TrendingUp, Minus as Flat } from "lucide-react";
import { MuscleMap } from "../components/MuscleMap";
import { FOCI, RECOVERY_COLOR, insights, lastTrained, progressionFor, recoveryOf, suggestedFocus, weeklySets } from "../lib/coach";
import { MUSCLE_NAMES, type MuscleId } from "../lib/muscles";
import { findExercise, useAppState } from "../store";
import { useNav } from "../nav";

const WEEKLY: MuscleId[] = ["chest", "lats", "upper_back", "shoulders", "biceps", "triceps", "quads", "hamstrings", "glutes", "abs", "calves"];
const TARGET: Partial<Record<MuscleId, number>> = { chest: 10, lats: 10, upper_back: 8, shoulders: 8, biceps: 6, triceps: 6, quads: 10, hamstrings: 8, glutes: 8, abs: 6, calves: 6 };

/** The offline coach: recovery, insights, next-session targets and weekly volume. */
export function CoachInsights({ tabs, onAsk }: { tabs: ReactNode; onAsk: () => void }) {
  const state = useAppState();
  const nav = useNav();
  const focus = useMemo(() => suggestedFocus(state), [state]);
  const trained = useMemo(() => lastTrained(state), [state]);
  const recoveryColors = useMemo(() => {
    const out: Partial<Record<MuscleId, string>> = {};
    (Object.keys(MUSCLE_NAMES) as MuscleId[]).forEach((m) => (out[m] = RECOVERY_COLOR[recoveryOf(trained[m])]));
    return out;
  }, [trained]);
  const tips = useMemo(() => insights(state), [state]);
  const sets = useMemo(() => weeklySets(state), [state]);
  const recentIds = useMemo(() => {
    const ids: string[] = [];
    for (const l of state.logs) for (const e of l.entries) if (!ids.includes(e.exerciseId)) ids.push(e.exerciseId);
    return ids.slice(0, 6);
  }, [state.logs]);
  const focusLabel = FOCI.find((f) => f.id === focus)?.label ?? "Full body";

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Coach</h1>
      </div>
      {tabs}

      <div className="card col" style={{ gap: 12 }}>
        <div className="row between">
          <div className="col" style={{ gap: 2 }}>
            <span className="eyebrow">Today's pick</span>
            <h2 style={{ fontSize: 22, fontWeight: 900 }}>{focusLabel}</h2>
          </div>
          <span className="small muted" style={{ textAlign: "right", maxWidth: 150 }}>
            Your most recovered muscles
          </span>
        </div>
        <MuscleMap primary={[]} secondary={[]} colors={recoveryColors} hideChips />
        <div className="row" style={{ justifyContent: "center", gap: 14 }}>
          {(["fresh", "recovering", "fatigued"] as const).map((r) => (
            <span key={r} className="row small" style={{ gap: 6, fontWeight: 650 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: RECOVERY_COLOR[r] }} />
              {r[0].toUpperCase() + r.slice(1)}
            </span>
          ))}
        </div>
        <button className="btn primary lg block" onClick={() => nav.push({ name: "generate", focus })}>
          <Sparkles size={18} /> Generate {focusLabel.toLowerCase()} workout
        </button>
      </div>

      <div className="section-title">
        <h2>Insights</h2>
      </div>
      <div className="col" style={{ gap: 10 }}>
        {tips.map((t, i) => (
          <div key={i} className={`card flat row insight ${t.tone}`} style={{ alignItems: "flex-start" }}>
            <span style={{ fontSize: 22 }}>{t.icon}</span>
            <div className="col" style={{ gap: 2 }}>
              <span style={{ fontWeight: 750 }}>{t.title}</span>
              <span className="small muted">{t.body}</span>
            </div>
          </div>
        ))}
      </div>

      {recentIds.length > 0 && (
        <>
          <div className="section-title">
            <h2>Next session targets</h2>
          </div>
          <div className="card flat list" style={{ padding: "4px 16px" }}>
            {recentIds.map((id) => {
              const ex = findExercise(id, state);
              const p = progressionFor(state, id);
              if (!ex || !p) return null;
              const Icon = p.trend === "up" ? TrendingUp : p.trend === "down" ? TrendingDown : Flat;
              const color = p.trend === "up" ? "var(--good)" : p.trend === "down" ? "var(--bad)" : "var(--warn)";
              return (
                <button key={id} className="list-item" onClick={() => nav.push({ name: "exercise", id })}>
                  <span className="emoji-badge">{ex.emoji}</span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{ex.name}</div>
                    <div className="small muted">{p.advice}</div>
                  </div>
                  <Icon size={20} color={color} />
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="section-title">
        <h2>Sets this week</h2>
      </div>
      <div className="card col" style={{ gap: 10 }}>
        {WEEKLY.map((m) => {
          const v = Math.round((sets[m] ?? 0) * 10) / 10;
          const target = TARGET[m] ?? 8;
          return (
            <div key={m} className="col" style={{ gap: 4 }}>
              <div className="row between small">
                <span style={{ fontWeight: 650 }}>{MUSCLE_NAMES[m]}</span>
                <span className="muted num">
                  {v} / {target}+
                </span>
              </div>
              <div className={`bar ${v >= target ? "good" : ""}`}>
                <div style={{ width: `${Math.min(100, (v / target) * 100)}%` }} />
              </div>
            </div>
          );
        })}
        <span className="small faint">Suggested weekly sets for growth. Supporting muscles count as half a set.</span>
      </div>

      <button className="card tap row" onClick={onAsk}>
        <MessageCircle size={22} color="var(--violet)" />
        <div className="grow">
          <div style={{ fontWeight: 750 }}>Ask the coach anything</div>
          <div className="small muted">Form, plateaus, injuries, nutrition. Answered with your training data.</div>
        </div>
      </button>
    </div>
  );
}
