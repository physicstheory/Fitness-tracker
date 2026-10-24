import { useState } from "react";
import { Play } from "lucide-react";
import { ExercisePreview, IntensityMeter, MusclesLine } from "../components/ExerciseInfo";
import { intensityOf } from "../lib/exerciseMeta";
import type { Exercise } from "../types";
import { BarChart, Overlay } from "../components/ui";
import { ExerciseGuide } from "../components/ExerciseGuide";
import { bestSet, bestWeight, dailyTotals, lifetimeTotal } from "../lib/stats";
import { findExercise, useAppState } from "../store";
import { ExerciseRow, FilterBar, useExerciseFilter } from "../components/ExercisePicker";
import { useNav } from "../nav";

export function Library() {
  const nav = useNav();
  const f = useExerciseFilter();
  const [preview, setPreview] = useState<Exercise | null>(null);
  return (
    <Overlay title="Exercise library">
      <FilterBar f={f} />
      <span className="small faint">{f.list.length} exercises</span>
      <div className="card flat list" style={{ padding: "4px 16px" }}>
        {f.list.map((e) => (
          <ExerciseRow key={e.id} e={e} onClick={() => nav.push({ name: "exercise", id: e.id })} onPreview={() => setPreview(e)} />
        ))}
        {!f.list.length && <p className="small muted" style={{ textAlign: "center", padding: 16 }}>No matches. Turn off "My equipment" to see everything.</p>}
      </div>
      <ExercisePreview e={preview} onClose={() => setPreview(null)} />
    </Overlay>
  );
}

export function ExerciseDetail({ id }: { id: string }) {
  const state = useAppState();
  const nav = useNav();
  const ex = findExercise(id, state);
  if (!ex) return <Overlay title="Exercise">Not found.</Overlay>;
  const best = bestSet(state.logs, ex.id);
  const heaviest = ex.weighted ? bestWeight(state.logs, ex.id) : null;
  const total = lifetimeTotal(state.logs, ex.id);
  const series = dailyTotals(state.logs, 14, ex.id);
  const unit = ex.type === "time" ? "s" : "";

  return (
    <Overlay title={ex.name}>
      <div className="row" style={{ gap: 14 }}>
        <div className="emoji-badge" style={{ width: 64, height: 64, fontSize: 34 }}>
          {ex.emoji}
        </div>
        <div className="col grow" style={{ gap: 6 }}>
          <h2 style={{ fontSize: 24, fontWeight: 850 }}>{ex.name}</h2>
          <div className="chips">
            {ex.muscleGroups.map((m) => (
              <span key={m} className="chip">
                {m}
              </span>
            ))}
            {ex.equipment && ex.equipment !== "None" && <span className="chip">{ex.equipment}</span>}
          </div>
        </div>
      </div>
      <div className="card flat col" style={{ gap: 6, padding: 12 }}>
        <IntensityMeter level={intensityOf(ex)} showLabel />
        <MusclesLine e={ex} />
      </div>
      <div className="grid-3">
        <div className="stat">
          {heaviest ? (
            <>
              <span className="value num">
                {heaviest.weight}
                {heaviest.unit ?? state.settings.units}
              </span>
              <span className="label">Heaviest</span>
            </>
          ) : (
            <>
              <span className="value num">
                {best}
                {unit}
              </span>
              <span className="label">Best set</span>
            </>
          )}
        </div>
        <div className="stat">
          <span className="value num">{total.toLocaleString()}</span>
          <span className="label">All-time {ex.type === "time" ? "secs" : "reps"}</span>
        </div>
        <div className="stat">
          <span className="value num">{ex.defaultRestSec}s</span>
          <span className="label">Rest</span>
        </div>
      </div>
      {total > 0 && (
        <div className="card">
          <span className="eyebrow">Last 14 days</span>
          <div style={{ marginTop: 10 }}>
            <BarChart data={series.map((d) => ({ label: String(d.date.getDate()), value: d.value }))} height={100} />
          </div>
        </div>
      )}
      <button className="btn primary lg block" onClick={() => nav.push({ name: "workout", exerciseId: ex.id })}>
        <Play size={18} fill="#fff" /> Quick session
      </button>
      <div className="card">
        <ExerciseGuide exercise={ex} />
      </div>
    </Overlay>
  );
}
