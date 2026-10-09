import { useState } from "react";
import { Activity, PersonStanding } from "lucide-react";
import { MuscleMap } from "./MuscleMap";
import { FormAnimation } from "./FormAnimation";
import { exerciseMuscles } from "../lib/muscles";
import { motionFor } from "../lib/motions";
import type { Exercise } from "../types";

export type VisualTab = "muscles" | "form";

/** Muscle map (orange, pulsing) and a form demo for one exercise, switchable with tabs. */
export function ExerciseVisual({ exercise, tab: initialTab = "muscles", compact = false }: { exercise: Exercise; tab?: VisualTab; compact?: boolean }) {
  const [tab, setTab] = useState<VisualTab>(initialTab);
  const { primary, secondary } = exerciseMuscles(exercise.muscleGroups, exercise.primaryCount);
  const motion = motionFor(exercise.name, exercise.motion);

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="seg" role="tablist" aria-label="Exercise visual">
        <button className={tab === "muscles" ? "on" : ""} onClick={() => setTab("muscles")} role="tab" aria-selected={tab === "muscles"}>
          <Activity size={13} style={{ verticalAlign: -2 }} /> Muscles worked
        </button>
        <button className={tab === "form" ? "on" : ""} onClick={() => setTab("form")} role="tab" aria-selected={tab === "form"}>
          <PersonStanding size={13} style={{ verticalAlign: -2 }} /> How to do it
        </button>
      </div>
      <div className={`visual-stage ${compact ? "compact" : ""}`} key={`${exercise.id}-${tab}`}>
        {tab === "muscles" ? (
          primary.length || secondary.length ? (
            <MuscleMap primary={primary} secondary={secondary} />
          ) : (
            <p className="small muted" style={{ textAlign: "center", padding: 24 }}>
              No specific muscles listed for this exercise.
            </p>
          )
        ) : motion ? (
          <div className="col" style={{ gap: 8, alignItems: "center" }}>
            <FormAnimation motion={motion} size={compact ? 240 : 300} />
            <p className="small muted" style={{ textAlign: "center" }}>
              {motion.cue}
            </p>
          </div>
        ) : (
          <p className="small muted" style={{ textAlign: "center", padding: 24 }}>
            No form animation for this exercise yet. Check the step-by-step guide below.
          </p>
        )}
      </div>
    </div>
  );
}
