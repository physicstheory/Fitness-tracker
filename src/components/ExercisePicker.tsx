import { useMemo, useState } from "react";
import { Check, Eye, Search } from "lucide-react";
import { Sheet } from "./ui";
import { ExercisePreview, IntensityMeter, MusclesLine } from "./ExerciseInfo";
import { allExercises, canDo, useAppState } from "../store";
import { exerciseMuscles, type MuscleId } from "../lib/muscles";
import { goalFit, intensityOf } from "../lib/exerciseMeta";
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

const GOAL_FILTERS = [
  { id: "strength", label: "🏋️ Strength" },
  { id: "aesthetics", label: "🪞 Aesthetics" },
  { id: "endurance", label: "🔋 Endurance" },
] as const;

type Sort = "az" | "easy" | "hard";

/** Search + muscle + goal + equipment filtering shared by the library, builder and picker. */
export function useExerciseFilter() {
  const state = useAppState();
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState<string | null>(null);
  const [goal, setGoal] = useState<(typeof GOAL_FILTERS)[number]["id"] | null>(null);
  const [mine, setMine] = useState(true);
  const [sort, setSort] = useState<Sort>("az");
  const list = useMemo(() => {
    const filter = MUSCLE_FILTERS.find((m) => m.label === muscle);
    const needle = q.trim().toLowerCase();
    const out = allExercises(state)
      .filter((e) => !mine || canDo(e, state))
      .filter((e) => !needle || (e.name + " " + e.muscleGroups.join(" ") + " " + e.equipment).toLowerCase().includes(needle))
      .filter((e) => !filter || exerciseMuscles(e.muscleGroups, e.primaryCount).primary.some((m) => filter.muscles.includes(m)))
      .filter((e) => !goal || goalFit(e)[goal]);
    return out.sort((a, b) => (sort === "az" ? a.name.localeCompare(b.name) : sort === "easy" ? intensityOf(a) - intensityOf(b) : intensityOf(b) - intensityOf(a)) || a.name.localeCompare(b.name));
  }, [state, q, muscle, goal, mine, sort]);
  return { q, setQ, muscle, setMuscle, goal, setGoal, mine, setMine, sort, setSort, list };
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
      <div className="set-chips">
        {GOAL_FILTERS.map((g) => (
          <button key={g.id} className={`chip ${f.goal === g.id ? "accent" : ""}`} style={{ padding: "7px 12px" }} onClick={() => f.setGoal(f.goal === g.id ? null : g.id)}>
            {g.label}
          </button>
        ))}
        <button className="chip" style={{ padding: "7px 12px" }} onClick={() => f.setSort(f.sort === "az" ? "easy" : f.sort === "easy" ? "hard" : "az")}>
          ↕ {f.sort === "az" ? "A–Z" : f.sort === "easy" ? "Easiest first" : "Hardest first"}
        </button>
      </div>
    </div>
  );
}

export function ExerciseRow({ e, right, onClick, onPreview, dim }: { e: Exercise; right?: React.ReactNode; onClick?: () => void; onPreview?: () => void; dim?: boolean }) {
  return (
    <div className="list-item" style={dim ? { opacity: 0.6 } : undefined}>
      <button className="row grow" style={{ minWidth: 0, textAlign: "left", gap: 12 }} onClick={onClick}>
        <span className="emoji-badge">{e.emoji}</span>
        <div className="col grow" style={{ minWidth: 0, gap: 3 }}>
          <div className="row" style={{ gap: 8, minWidth: 0 }}>
            <span style={{ fontWeight: 750 }} className="ellipsis">
              {e.name}
            </span>
            <IntensityMeter level={intensityOf(e)} />
          </div>
          <MusclesLine e={e} />
        </div>
      </button>
      {onPreview && (
        <button className="icon-btn" style={{ width: 36, height: 36 }} onClick={onPreview} aria-label={`Preview ${e.name}`}>
          <Eye size={16} />
        </button>
      )}
      {right}
    </div>
  );
}

/** Multi-select exercise picker in a sheet. */
export function ExercisePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (ids: string[]) => void }) {
  const f = useExerciseFilter();
  const [picked, setPicked] = useState<string[]>([]);
  const [preview, setPreview] = useState<Exercise | null>(null);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <>
      <Sheet
        open={open && !preview}
        onClose={() => {
          setPicked([]);
          onClose();
        }}
        title="Add exercises"
      >
        <div className="col" style={{ gap: 12 }}>
          <FilterBar f={f} />
          <div className="list" style={{ maxHeight: "44dvh", overflowY: "auto" }}>
            {f.list.map((e) => (
              <ExerciseRow
                key={e.id}
                e={e}
                onClick={() => toggle(e.id)}
                onPreview={() => setPreview(e)}
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
      <ExercisePreview e={open ? preview : null} onClose={() => setPreview(null)} onAdd={(e) => setPicked((p) => (p.includes(e.id) ? p : [...p, e.id]))} />
    </>
  );
}
