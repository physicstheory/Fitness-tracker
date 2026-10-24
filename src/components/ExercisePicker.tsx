import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { Sheet } from "./ui";
import { allExercises, canDo, useAppState } from "../store";
import { exerciseMuscles, MUSCLE_NAMES, type MuscleId } from "../lib/muscles";
import { equipmentName } from "../data/equipment";
import type { Exercise } from "../types";

export const MUSCLE_FILTERS: { label: string; muscles: MuscleId[] }[] = [
  { label: "Chest", muscles: ["chest"] },
  { label: "Back", muscles: ["lats", "upper_back", "lower_back", "traps"] },
  { label: "Shoulders", muscles: ["shoulders"] },
  { label: "Arms", muscles: ["biceps", "triceps", "forearms"] },
  { label: "Legs", muscles: ["quads", "hamstrings", "adductors", "calves"] },
  { label: "Glutes", muscles: ["glutes"] },
  { label: "Core", muscles: ["abs", "obliques", "hip_flexors"] },
];

/** Search + muscle + equipment filtering shared by the library, builder and picker. */
export function useExerciseFilter() {
  const state = useAppState();
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState<string | null>(null);
  const [mine, setMine] = useState(true);
  const list = useMemo(() => {
    const filter = MUSCLE_FILTERS.find((m) => m.label === muscle);
    const needle = q.trim().toLowerCase();
    return allExercises(state)
      .filter((e) => !mine || canDo(e, state))
      .filter((e) => !needle || (e.name + " " + e.muscleGroups.join(" ") + " " + e.equipment).toLowerCase().includes(needle))
      .filter((e) => {
        if (!filter) return true;
        if (muscle === "Cardio") return false;
        return exerciseMuscles(e.muscleGroups, e.primaryCount).primary.some((m) => filter.muscles.includes(m));
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state, q, muscle, mine]);
  return { q, setQ, muscle, setMuscle, mine, setMine, list };
}

export function FilterBar({ f }: { f: ReturnType<typeof useExerciseFilter> }) {
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="row card flat" style={{ padding: "4px 14px" }}>
        <Search size={18} className="faint" />
        <input className="input" style={{ background: "transparent", border: 0, padding: "10px 0" }} placeholder="Search 120+ exercises" value={f.q} onChange={(e) => f.setQ(e.target.value)} />
      </div>
      <div className="set-chips">
        <button className={`chip ${f.mine ? "accent" : ""}`} style={{ padding: "7px 12px" }} onClick={() => f.setMine(!f.mine)}>
          {f.mine ? "✓ " : ""}My equipment
        </button>
        {MUSCLE_FILTERS.map((m) => (
          <button key={m.label} className={`chip ${f.muscle === m.label ? "accent" : ""}`} style={{ padding: "7px 12px" }} onClick={() => f.setMuscle(f.muscle === m.label ? null : m.label)}>
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ExerciseRow({ e, right, onClick, dim }: { e: Exercise; right?: React.ReactNode; onClick?: () => void; dim?: boolean }) {
  const { primary } = exerciseMuscles(e.muscleGroups, e.primaryCount);
  return (
    <button className="list-item" onClick={onClick} style={dim ? { opacity: 0.6 } : undefined}>
      <span className="emoji-badge">{e.emoji}</span>
      <div className="grow" style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700 }} className="ellipsis">
          {e.name}
        </div>
        <div className="small muted ellipsis">
          {primary.map((m) => MUSCLE_NAMES[m]).join(", ")}
          {(e.equipmentIds ?? []).length ? ` · ${(e.equipmentIds ?? []).map(equipmentName).join(", ")}` : " · Bodyweight"}
        </div>
      </div>
      {right}
    </button>
  );
}

/** Multi-select exercise picker in a sheet. */
export function ExercisePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (ids: string[]) => void }) {
  const f = useExerciseFilter();
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <Sheet
      open={open}
      onClose={() => {
        setPicked([]);
        onClose();
      }}
      title="Add exercises"
    >
      <div className="col" style={{ gap: 12 }}>
        <FilterBar f={f} />
        <div className="list" style={{ maxHeight: "48dvh", overflowY: "auto" }}>
          {f.list.map((e) => (
            <ExerciseRow
              key={e.id}
              e={e}
              onClick={() => toggle(e.id)}
              right={<span className={`check-dot ${picked.includes(e.id) ? "on" : ""}`}>{picked.includes(e.id) && <Check size={16} />}</span>}
            />
          ))}
          {!f.list.length && <p className="small muted" style={{ textAlign: "center", padding: 16 }}>No exercises match.</p>}
        </div>
        <button
          className="btn primary block"
          disabled={!picked.length}
          onClick={() => {
            onPick(picked);
            setPicked([]);
            onClose();
          }}
        >
          Add {picked.length || ""} exercise{picked.length === 1 ? "" : "s"}
        </button>
      </div>
    </Sheet>
  );
}
