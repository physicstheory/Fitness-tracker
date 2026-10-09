import { useState } from "react";
import { ChevronRight, Play, Search } from "lucide-react";
import { BarChart, Overlay } from "../components/ui";
import { ExerciseGuide } from "../components/ExerciseGuide";
import { bestSet, dailyTotals, lifetimeTotal } from "../lib/stats";
import { allExercises, findExercise, useAppState } from "../store";
import { useNav } from "../nav";

export function Library() {
  const state = useAppState();
  const nav = useNav();
  const [q, setQ] = useState("");
  const list = allExercises(state).filter((e) => (e.name + e.muscleGroups.join(" ")).toLowerCase().includes(q.toLowerCase()));
  return (
    <Overlay title="Exercise library">
      <div className="row card flat" style={{ padding: "4px 14px" }}>
        <Search size={18} className="faint" />
        <input className="input" style={{ background: "transparent", border: 0, padding: "10px 0" }} placeholder="Search exercises or muscles" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="card flat list" style={{ padding: "4px 16px" }}>
        {list.map((e) => (
          <button key={e.id} className="list-item" onClick={() => nav.push({ name: "exercise", id: e.id })}>
            <span className="emoji-badge">{e.emoji}</span>
            <div className="grow" style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{e.name}</div>
              <div className="small muted ellipsis">{e.muscleGroups.join(", ") || e.equipment}</div>
            </div>
            {state.guides[e.id] && <span className="chip accent">AI</span>}
            <ChevronRight size={18} className="faint" />
          </button>
        ))}
      </div>
    </Overlay>
  );
}

export function ExerciseDetail({ id }: { id: string }) {
  const state = useAppState();
  const nav = useNav();
  const ex = findExercise(id, state);
  if (!ex) return <Overlay title="Exercise">Not found.</Overlay>;
  const best = bestSet(state.logs, ex.id);
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
      <div className="grid-3">
        <div className="stat">
          <span className="value num">
            {best}
            {unit}
          </span>
          <span className="label">Best set</span>
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
