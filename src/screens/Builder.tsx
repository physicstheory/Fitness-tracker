import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Minus, Play, Plus, Save, Shuffle, Sparkles, Trash2 } from "lucide-react";
import { Overlay } from "../components/ui";
import { ExercisePicker } from "../components/ExercisePicker";
import { MuscleMap } from "../components/MuscleMap";
import { exerciseMuscles, type MuscleId } from "../lib/muscles";
import { FOCI, generateWorkout, suggestedFocus, type Focus } from "../lib/coach";
import { findExercise, findProgram, getState, saveRoutine, useAppState } from "../store";
import { useNav } from "../nav";
import type { ProgramItem } from "../types";

const DURATIONS = [20, 30, 45, 60];

/** Combined muscle coverage of a list of exercises. */
function coverage(items: ProgramItem[]) {
  const primary = new Set<MuscleId>();
  const secondary = new Set<MuscleId>();
  for (const it of items) {
    const ex = findExercise(it.exerciseId);
    if (!ex) continue;
    const m = exerciseMuscles(ex.muscleGroups, ex.primaryCount);
    m.primary.forEach((x) => primary.add(x));
    m.secondary.forEach((x) => secondary.add(x));
  }
  primary.forEach((x) => secondary.delete(x));
  return { primary: [...primary], secondary: [...secondary] };
}

/** Editable list of exercises with sets, reps, weight and rest. */
function ItemEditor({ items, setItems }: { items: ProgramItem[]; setItems: (f: (i: ProgramItem[]) => ProgramItem[]) => void }) {
  const units = useAppState().settings.units;
  const update = (i: number, patch: Partial<ProgramItem>) => setItems((its) => its.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  return (
    <div className="col" style={{ gap: 10 }}>
      {items.map((it, i) => {
        const ex = findExercise(it.exerciseId);
        if (!ex) return null;
        const reps = it.sets[0] ?? 10;
        const weight = it.weights?.[0];
        const setCount = (n: number) => update(i, { sets: Array(Math.max(1, n)).fill(reps), weights: weight ? Array(Math.max(1, n)).fill(weight) : undefined });
        return (
          <div key={i} className="card flat col" style={{ gap: 10, padding: 12 }}>
            <div className="row">
              <span className="emoji-badge" style={{ width: 38, height: 38, fontSize: 18 }}>
                {ex.emoji}
              </span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="ellipsis" style={{ fontWeight: 750 }}>
                  {ex.name}
                </div>
                {it.notes && <div className="small muted ellipsis">{it.notes}</div>}
              </div>
              <button className="icon-btn" style={{ width: 34, height: 34 }} disabled={i === 0} onClick={() => setItems((its) => its.map((x, j) => (j === i - 1 ? its[i] : j === i ? its[i - 1] : x)))} aria-label="Move up">
                <ArrowUp size={15} />
              </button>
              <button className="icon-btn" style={{ width: 34, height: 34 }} disabled={i === items.length - 1} onClick={() => setItems((its) => its.map((x, j) => (j === i + 1 ? its[i] : j === i ? its[i + 1] : x)))} aria-label="Move down">
                <ArrowDown size={15} />
              </button>
              <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => setItems((its) => its.filter((_, j) => j !== i))} aria-label="Remove">
                <Trash2 size={15} color="var(--bad)" />
              </button>
            </div>
            <div className="builder-grid">
              <Stepper label="Sets" value={it.sets.length} onChange={setCount} />
              <Stepper label={ex.type === "time" ? "Seconds" : "Reps"} value={reps} step={ex.type === "time" ? 5 : 1} onChange={(v) => update(i, { sets: it.sets.map(() => Math.max(0, v)) })} />
              {ex.weighted && <Stepper label={units} value={weight ?? 0} step={units === "kg" ? 2.5 : 5} onChange={(v) => update(i, { weights: v > 0 ? it.sets.map(() => v) : undefined })} />}
              <Stepper label="Rest s" value={it.restSec} step={15} onChange={(v) => update(i, { restSec: Math.max(0, v) })} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stepper({ label, value, step = 1, onChange }: { label: string; value: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div className="stepper">
      <span className="faint">{label}</span>
      <div className="row" style={{ gap: 4 }}>
        <button onClick={() => onChange(Math.max(0, Math.round((value - step) * 10) / 10))} aria-label={`Less ${label}`}>
          <Minus size={13} />
        </button>
        <span className="num">{value === 0 && label !== "Sets" ? "MAX" : value}</span>
        <button onClick={() => onChange(Math.round((value + step) * 10) / 10)} aria-label={`More ${label}`}>
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}

/** Build or edit a custom routine. */
export function Builder({ id, items: initialItems, title: initialTitle }: { id?: string; items?: ProgramItem[]; title?: string }) {
  const nav = useNav();
  const existing = findProgram(id);
  const [title, setTitle] = useState(initialTitle ?? existing?.name ?? "");
  const [items, setItems] = useState<ProgramItem[]>(initialItems ?? existing?.days[0]?.items ?? []);
  const [picking, setPicking] = useState(false);
  const cov = useMemo(() => coverage(items), [items]);

  function add(ids: string[]) {
    const s = getState();
    setItems((its) => [
      ...its,
      ...ids.map((eid) => {
        const ex = findExercise(eid, s)!;
        return { exerciseId: eid, sets: [ex.type === "time" ? 30 : ex.weighted ? 8 : 10, ex.type === "time" ? 30 : ex.weighted ? 8 : 10, ex.type === "time" ? 30 : ex.weighted ? 8 : 10], restSec: ex.defaultRestSec, notes: "" };
      }),
    ]);
  }

  function save(start: boolean) {
    const pid = saveRoutine(title.trim() || "My workout", items, existing?.source === "custom" ? existing.id : undefined);
    if (start) nav.replace({ name: "workout", programId: pid, dayId: `${pid}-d` });
    else nav.pop();
  }

  return (
    <Overlay title={existing ? "Edit workout" : "Build a workout"}>
      <input className="input" style={{ fontSize: 20, fontWeight: 800 }} placeholder="Workout name (e.g. Push Day)" value={title} onChange={(e) => setTitle(e.target.value)} />
      {items.length > 0 && (
        <div className="card flat" style={{ padding: 10 }}>
          <MuscleMap primary={cov.primary} secondary={cov.secondary} />
        </div>
      )}
      <ItemEditor items={items} setItems={setItems} />
      <button className="btn block" onClick={() => setPicking(true)} style={{ borderStyle: "dashed" }}>
        <Plus size={16} /> Add exercises
      </button>
      {items.length > 0 && (
        <>
          <button className="btn primary lg block" onClick={() => save(true)}>
            <Play size={18} fill="#fff" /> Save & start
          </button>
          <button className="btn block" onClick={() => save(false)}>
            <Save size={16} /> Save to my workouts
          </button>
        </>
      )}
      <ExercisePicker open={picking} onClose={() => setPicking(false)} onPick={add} />
    </Overlay>
  );
}

/** Auto-generate a workout from a focus, time and the user's equipment and recovery. */
export function Generator({ focus: initialFocus }: { focus?: string }) {
  const nav = useNav();
  const state = useAppState();
  const suggested = useMemo(() => suggestedFocus(state), [state]);
  const [focus, setFocus] = useState<Focus>((initialFocus as Focus) ?? suggested);
  const [minutes, setMinutes] = useState(45);
  const [seed, setSeed] = useState(() => Date.now());
  const [items, setItems] = useState<ProgramItem[] | null>(null);
  const generated = useMemo(() => generateWorkout(state, focus, minutes, seed), [state, focus, minutes, seed]);
  const current = items ?? generated.items;
  const cov = useMemo(() => coverage(current), [current]);
  const regenerate = (patch: () => void) => {
    patch();
    setItems(null);
  };

  return (
    <Overlay title="Generate a workout">
      <div className="col" style={{ gap: 8 }}>
        <span className="eyebrow">Focus</span>
        <div className="chips">
          {FOCI.map((f) => (
            <button key={f.id} className={`chip ${focus === f.id ? "accent" : ""}`} style={{ padding: "8px 12px", fontSize: 13 }} onClick={() => regenerate(() => setFocus(f.id))}>
              {f.label}
              {f.id === suggested && " ✨"}
            </button>
          ))}
        </div>
        <span className="small faint">✨ = coach pick, based on which muscles are most recovered.</span>
      </div>
      <div className="col" style={{ gap: 8 }}>
        <span className="eyebrow">Time</span>
        <div className="seg">
          {DURATIONS.map((d) => (
            <button key={d} className={minutes === d ? "on" : ""} onClick={() => regenerate(() => setMinutes(d))}>
              {d} min
            </button>
          ))}
        </div>
      </div>

      {current.length ? (
        <>
          <div className="card flat" style={{ padding: 10 }}>
            <MuscleMap primary={cov.primary} secondary={cov.secondary} />
          </div>
          <div className="row between">
            <span className="eyebrow">
              {current.length} exercises · {current.reduce((a, it) => a + it.sets.length, 0)} sets
            </span>
            <button className="btn sm" onClick={() => regenerate(() => setSeed(Date.now()))}>
              <Shuffle size={14} /> Shuffle
            </button>
          </div>
          <ItemEditor items={current} setItems={(f) => setItems(f(current))} />
          <button
            className="btn primary lg block"
            onClick={() => nav.replace({ name: "workout", items: current, title: generated.title })}
          >
            <Play size={18} fill="#fff" /> Start workout
          </button>
          <button className="btn block" onClick={() => nav.replace({ name: "builder", items: current, title: generated.title })}>
            <Save size={16} /> Customise & save
          </button>
        </>
      ) : (
        <div className="banner">
          <Sparkles size={16} /> No exercises match this focus with your equipment. Add equipment on the Today screen or pick another focus.
        </div>
      )}
    </Overlay>
  );
}

