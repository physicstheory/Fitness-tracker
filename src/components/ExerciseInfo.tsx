import { Plus } from "lucide-react";
import { Sheet } from "./ui";
import { ExerciseVisual } from "./ExerciseVisual";
import { GOALS, INTENSITY_COLORS, INTENSITY_LABELS, goalFit, intensityOf, schemeFor, type TrainingGoal } from "../lib/exerciseMeta";
import { exerciseMuscles, MUSCLE_NAMES } from "../lib/muscles";
import { setState, useAppState } from "../store";
import { equipmentName } from "../data/equipment";
import type { Exercise } from "../types";

export function IntensityMeter({ level, showLabel = false }: { level: number; showLabel?: boolean }) {
  return (
    <span className="row" style={{ gap: 6 }} title={`Intensity: ${INTENSITY_LABELS[level]}`}>
      <span className="intensity" style={{ ["--int-color" as string]: INTENSITY_COLORS[level] }} aria-label={`Intensity ${level} of 5`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <i key={i} className={i <= level ? "on" : ""} style={{ height: 5 + i * 2 }} />
        ))}
      </span>
      {showLabel && (
        <span className="small" style={{ fontWeight: 750, color: INTENSITY_COLORS[level] }}>
          {INTENSITY_LABELS[level]}
        </span>
      )}
    </span>
  );
}

/** "Works: Chest · also Triceps, Shoulders" */
export function MusclesLine({ e }: { e: Exercise }) {
  const { primary, secondary } = exerciseMuscles(e.muscleGroups, e.primaryCount);
  return (
    <span className="small muted ellipsis">
      <b style={{ color: "var(--text)", fontWeight: 700 }}>{primary.map((m) => MUSCLE_NAMES[m]).join(", ") || "Full body"}</b>
      {secondary.length > 0 && ` · also ${secondary.map((m) => MUSCLE_NAMES[m]).join(", ")}`}
    </span>
  );
}

export function GoalPicker() {
  const goal = (useAppState().profile.trainingGoal ?? "general") as TrainingGoal;
  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="seg">
        {GOALS.map((g) => (
          <button key={g.id} className={goal === g.id ? "on" : ""} onClick={() => setState((s) => ({ ...s, profile: { ...s.profile, trainingGoal: g.id } }))}>
            {g.emoji} {g.label.replace(" fitness", "")}
          </button>
        ))}
      </div>
      <span className="small faint">{GOALS.find((g) => g.id === goal)?.blurb}</span>
    </div>
  );
}

/** Tap-through preview: what it works, how hard it is, how to do it, and reps for your goal. */
export function ExercisePreview({ e, onClose, onAdd }: { e: Exercise | null; onClose: () => void; onAdd?: (e: Exercise) => void }) {
  const state = useAppState();
  if (!e) return null;
  const level = intensityOf(e);
  const fit = goalFit(e);
  const goal = (state.profile.trainingGoal ?? "general") as TrainingGoal;
  const sc = schemeFor(e, goal, state.profile.level);
  return (
    <Sheet open={!!e} onClose={onClose} title={`${e.emoji} ${e.name}`}>
      <div className="col" style={{ gap: 14 }}>
        <div className="row between">
          <IntensityMeter level={level} showLabel />
          <span className="small muted">{(e.equipmentIds ?? []).length ? (e.equipmentIds ?? []).map(equipmentName).join(", ") : "No equipment"}</span>
        </div>
        <MusclesLine e={e} />
        <ExerciseVisual exercise={e} tab="form" compact />
        <div className="card flat col" style={{ gap: 6, padding: 12 }}>
          <span className="eyebrow">For your goal · {GOALS.find((g) => g.id === goal)?.label}</span>
          <span style={{ fontWeight: 800, fontSize: 18 }} className="num">
            {sc.sets} × {sc.range}
            {e.type === "time" ? "" : " reps"} · {sc.rest}s rest
          </span>
          <div className="chips">
            {(["strength", "aesthetics", "endurance"] as const).map((g) => (
              <span key={g} className={`chip ${fit[g] ? "good" : ""}`} style={fit[g] ? undefined : { opacity: 0.5 }}>
                {fit[g] ? "✓" : "–"} {GOALS.find((x) => x.id === g)?.label}
              </span>
            ))}
          </div>
        </div>
        {e.cues.length > 0 && (
          <div className="chips">
            {e.cues.map((c) => (
              <span key={c} className="chip accent">
                {c}
              </span>
            ))}
          </div>
        )}
        {onAdd && (
          <button
            className="btn primary block"
            onClick={() => {
              onAdd(e);
              onClose();
            }}
          >
            <Plus size={16} /> Add to workout
          </button>
        )}
      </div>
    </Sheet>
  );
}
