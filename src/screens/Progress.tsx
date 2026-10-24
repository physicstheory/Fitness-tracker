import { useState } from "react";
import { BarChart3, ChevronRight, Medal, Trash2 } from "lucide-react";
import { BarChart, Empty, Sheet } from "../components/ui";
import { addDays, bestSet, bestWeight, dailyTotals, fmtDuration, lifetimeTotal, logTotal, streak } from "../lib/stats";
import { allExercises, findExercise, setState, useAppState } from "../store";
import { useNav } from "../nav";
import type { WorkoutLog } from "../types";
import { MuscleMap } from "../components/MuscleMap";
import { TIERS, levelFor, muscleRanks, totalXP } from "../lib/progression";
import { MUSCLE_NAMES, type MuscleId } from "../lib/muscles";

const RANGES = [
  { days: 7, label: "7D" },
  { days: 14, label: "14D" },
  { days: 30, label: "30D" },
];

export function Progress() {
  const state = useAppState();
  const nav = useNav();
  const [range, setRange] = useState(14);
  const [exerciseId, setExerciseId] = useState<string>("");
  const [selected, setSelected] = useState<WorkoutLog | null>(null);
  const logs = state.logs;
  const { current, best } = streak(logs);
  const series = dailyTotals(logs, range, exerciseId || undefined);
  const weekTotal = dailyTotals(logs, 7).reduce((a, d) => a + d.value, 0);
  const trained = allExercises(state).filter((e) => logs.some((l) => l.entries.some((x) => x.exerciseId === e.id)));

  // 16-week heatmap, Monday-first columns.
  const today = new Date();
  const start = addDays(today, -((today.getDay() + 6) % 7) - 15 * 7);
  const heat = dailyTotals(logs, Math.round((today.getTime() - start.getTime()) / 86400000) + 1);
  const heatMax = Math.max(1, ...heat.map((h) => h.value));

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Progress</h1>
      </div>

      <LevelCard />
      <MuscleRanks />

      <div className="grid-2">
        <div className="stat">
          <span className="value num">{logs.length}</span>
          <span className="label">Workouts</span>
        </div>
        <div className="stat">
          <span className="value num">{weekTotal}</span>
          <span className="label">Reps this week</span>
        </div>
        <div className="stat">
          <span className="value num">🔥 {current}</span>
          <span className="label">Current streak</span>
        </div>
        <div className="stat">
          <span className="value num">{best}</span>
          <span className="label">Best streak</span>
        </div>
      </div>

      <div className="card col" style={{ gap: 14 }}>
        <div className="row between">
          <select className="input" style={{ width: "auto", padding: "6px 10px", fontSize: 14 }} value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
            <option value="">All exercises</option>
            {trained.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <div className="seg" style={{ width: 150 }}>
            {RANGES.map((r) => (
              <button key={r.days} className={range === r.days ? "on" : ""} onClick={() => setRange(r.days)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <BarChart
          data={series.map((d, i) => ({
            label: range <= 14 || i % 5 === 0 || i === series.length - 1 ? (range <= 7 ? d.date.toLocaleDateString(undefined, { weekday: "narrow" }) : String(d.date.getDate())) : "",
            value: d.value,
          }))}
          target={!exerciseId ? state.settings.dailyRepTarget : undefined}
        />
        <div className="row between small muted">
          <span>Total: {series.reduce((a, d) => a + d.value, 0)}</span>
          <span>Best day: {Math.max(0, ...series.map((d) => d.value))}</span>
        </div>
      </div>

      <div className="card col">
        <span className="eyebrow">Last 16 weeks</span>
        <div className="heatmap">
          {heat.map((h) => (
            <div
              key={h.key}
              title={`${h.key}: ${h.value}`}
              style={h.value ? { background: `color-mix(in srgb, var(--accent) ${25 + (h.value / heatMax) * 75}%, transparent)` } : undefined}
            />
          ))}
        </div>
      </div>

      {trained.length > 0 && (
        <>
          <div className="section-title">
            <h2>Personal records</h2>
          </div>
          <div className="card flat list" style={{ padding: "4px 16px" }}>
            {trained.map((e) => (
              <button key={e.id} className="list-item" onClick={() => nav.push({ name: "exercise", id: e.id })}>
                <span className="emoji-badge">{e.emoji}</span>
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>{e.name}</div>
                  <div className="small muted num">
                    {lifetimeTotal(logs, e.id).toLocaleString()} {e.type === "time" ? "seconds" : "reps"} all-time
                  </div>
                </div>
                <div className="col" style={{ alignItems: "flex-end", gap: 0 }}>
                  <span className="row num" style={{ gap: 4, fontWeight: 800 }}>
                    <Medal size={15} color="var(--accent-2)" />
                    {(() => {
                      const w = e.weighted ? bestWeight(logs, e.id) : null;
                      return w ? `${w.weight}${w.unit ?? state.settings.units}` : `${bestSet(logs, e.id)}${e.type === "time" ? "s" : ""}`;
                    })()}
                  </span>
                  <span className="faint" style={{ fontSize: 11 }}>
                    {e.weighted && bestWeight(logs, e.id) ? "heaviest" : "best set"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="section-title">
        <h2>History</h2>
      </div>
      {logs.length === 0 ? (
        <div className="card">
          <Empty icon={<BarChart3 color="var(--accent)" />} title="No workouts yet">
            <p className="small">Finish a session and it'll show up here.</p>
          </Empty>
        </div>
      ) : (
        <div className="card flat list" style={{ padding: "4px 16px" }}>
          {logs.slice(0, 60).map((l) => (
            <button key={l.id} className="list-item" onClick={() => setSelected(l)}>
              <div className="col" style={{ alignItems: "center", width: 44, gap: 0 }}>
                <span className="faint" style={{ fontSize: 11, fontWeight: 700 }}>
                  {new Date(l.date).toLocaleDateString(undefined, { month: "short" }).toUpperCase()}
                </span>
                <span className="num" style={{ fontSize: 20, fontWeight: 900, lineHeight: 1 }}>
                  {new Date(l.date).getDate()}
                </span>
              </div>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="ellipsis" style={{ fontWeight: 700 }}>
                  {l.title}
                </div>
                <div className="small muted">
                  {logTotal(l)} total · {fmtDuration(l.durationSec)}
                </div>
              </div>
              <ChevronRight size={18} className="faint" />
            </button>
          ))}
        </div>
      )}

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected?.title}>
        {selected && (
          <div className="col" style={{ gap: 14 }}>
            <p className="muted small">
              {new Date(selected.date).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })} · {fmtDuration(selected.durationSec)}
              {selected.feeling ? ` · ${["😫", "😓", "🙂", "😀", "🔥"][selected.feeling - 1]}` : ""}
            </p>
            {selected.entries.map((e, i) => {
              const ex = findExercise(e.exerciseId, state);
              return (
                <div key={i} className="col" style={{ gap: 6 }}>
                  <span style={{ fontWeight: 700 }}>
                    {ex?.emoji} {ex?.name ?? e.exerciseId}
                  </span>
                  <div className="chips">
                    {e.sets.map((s, j) => (
                      <span key={j} className={`chip num ${s.target && s.actual < s.target ? "" : "good"}`}>
                        {s.actual}
                        {ex?.type === "time" ? "s" : ""}
                        {s.target ? ` / ${s.target}` : ""}
                        {s.weight ? ` × ${s.weight}${s.unit ?? ""}` : ""}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
            <button
              className="btn block danger"
              onClick={() => {
                setState((s) => ({ ...s, logs: s.logs.filter((x) => x.id !== selected.id) }));
                setSelected(null);
              }}
            >
              <Trash2 size={16} /> Delete workout
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}


function LevelCard() {
  const state = useAppState();
  const xp = totalXP(state);
  const lv = levelFor(xp);
  return (
    <div className="card hero col" style={{ gap: 10 }}>
      <div className="row between" style={{ position: "relative", zIndex: 1 }}>
        <div className="col" style={{ gap: 0 }}>
          <span className="eyebrow" style={{ color: "rgba(255,255,255,.85)" }}>
            Level {lv.level}
          </span>
          <h2 style={{ fontSize: 28, fontWeight: 900 }}>{lv.title}</h2>
        </div>
        <span className="num" style={{ fontSize: 26, fontWeight: 900 }}>
          {xp.toLocaleString()} XP
        </span>
      </div>
      <div className="bar" style={{ background: "rgba(255,255,255,.25)", position: "relative", zIndex: 1 }}>
        <div style={{ width: `${Math.round(lv.progress * 100)}%`, background: "#fff" }} />
      </div>
      <span className="small muted" style={{ position: "relative", zIndex: 1 }}>
        {Math.round(lv.needed - lv.into)} XP to level {lv.level + 1}. Every set earns XP; heavier and longer sets earn more.
      </span>
    </div>
  );
}

function MuscleRanks() {
  const state = useAppState();
  const ranks = muscleRanks(state);
  const colors: Partial<Record<MuscleId, string>> = {};
  (Object.keys(MUSCLE_NAMES) as MuscleId[]).forEach((m) => (colors[m] = ranks[m]?.tier.color ?? "var(--muscle)"));
  const list = (Object.keys(MUSCLE_NAMES) as MuscleId[]).map((m) => ({ m, r: ranks[m] })).sort((a, b) => (b.r?.score ?? 0) - (a.r?.score ?? 0));
  return (
    <div className="card col" style={{ gap: 12 }}>
      <div className="row between">
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>Muscle ranks</h2>
        <span className="small faint">last 30 days</span>
      </div>
      <MuscleMap primary={[]} secondary={[]} colors={colors} hideChips />
      <div className="rank-grid">
        {list.map(({ m, r }) => {
          const tier = r?.tier ?? TIERS[0];
          const next = TIERS[TIERS.indexOf(tier) + 1];
          return (
            <div key={m} className="rank-cell">
              <span style={{ fontSize: 18 }}>{tier.emoji}</span>
              <div className="col grow" style={{ gap: 2, minWidth: 0 }}>
                <span className="small ellipsis" style={{ fontWeight: 750 }}>
                  {MUSCLE_NAMES[m]}
                </span>
                <span className="faint ellipsis" style={{ fontSize: 11, fontWeight: 650 }}>
                  {tier.name}
                </span>
                {next && (
                  <div className="bar" style={{ height: 4 }}>
                    <div style={{ width: `${Math.min(100, (((r?.score ?? 0) - tier.min) / (next.min - tier.min)) * 100)}%`, background: next.color }} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <span className="small faint">Train a muscle more (more sets, reps or weight) to climb from Bronze to Legend.</span>
    </div>
  );
}
