import { useState } from "react";
import { AlertTriangle, CalendarDays, ChevronRight, Plus, Sparkles, Target, Trash2, Trophy } from "lucide-react";
import { AIBadge, AILoading, Empty, ProgressRing, Sheet } from "../components/ui";
import { fetchGoalPlan } from "../lib/api";
import { bestSet, goalProgress, historySummary } from "../lib/stats";
import { allExercises, findExercise, findProgram, getState, saveAIProgram, setState, uid, useAppState } from "../store";
import { useNav } from "../nav";
import { useAIAvailable } from "../hooks";
import type { Goal, GoalMetric } from "../types";

const METRICS: { id: GoalMetric; label: string; hint: string }[] = [
  { id: "max_set", label: "In one set", hint: "Most reps (or seconds) in a single unbroken set" },
  { id: "daily_total", label: "In one day", hint: "Total reps across a single day" },
  { id: "total", label: "Cumulative", hint: "Total reps logged from today until the deadline" },
];

const FEAS: Record<string, { label: string; color: string }> = {
  very_achievable: { label: "Very achievable", color: "var(--good)" },
  achievable: { label: "Achievable", color: "var(--good)" },
  ambitious: { label: "Ambitious", color: "var(--warn)" },
  unrealistic: { label: "Very ambitious", color: "var(--bad)" },
};

export function Goals() {
  const state = useAppState();
  const [creating, setCreating] = useState(false);
  const active = state.goals.filter((g) => !g.achievedAt);
  const done = state.goals.filter((g) => g.achievedAt);

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Goals</h1>
        <button className="btn sm primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> New goal
        </button>
      </div>

      {state.goals.length === 0 && (
        <div className="card">
          <Empty icon={<Target color="var(--accent)" />} title="Set a target to chase">
            <p className="small">e.g. 100 push-ups in one set, a 3-minute plank, or 10,000 squats this year. The AI coach builds a week-by-week plan to get you there.</p>
            <button className="btn primary" onClick={() => setCreating(true)}>
              <Sparkles size={16} /> Create a goal
            </button>
          </Empty>
        </div>
      )}

      {active.map((g) => (
        <GoalCard key={g.id} goal={g} />
      ))}

      {done.length > 0 && (
        <>
          <div className="section-title">
            <h2>Achieved</h2>
          </div>
          {done.map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}
        </>
      )}

      <NewGoalSheet open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const state = useAppState();
  const nav = useNav();
  const [open, setOpen] = useState(false);
  const ex = findExercise(goal.exerciseId, state);
  const value = goalProgress(goal, state.logs);
  const pct = Math.min(1, value / goal.target);
  const unit = ex?.type === "time" ? "s" : "";
  const plan = goal.plan;
  const program = findProgram(plan?.programId, state);
  const daysLeft = goal.deadline ? Math.ceil((new Date(goal.deadline + "T23:59").getTime() - Date.now()) / 86400000) : null;
  const week = Math.floor((Date.now() - goal.createdAt) / (7 * 86400000)) + 1;
  const milestone = plan?.weeklyMilestones.find((m) => m.week === week) ?? plan?.weeklyMilestones.at(-1);

  return (
    <div className="card col" style={{ gap: 14 }}>
      <div className="row" style={{ gap: 16 }}>
        <ProgressRing value={pct} size={86} stroke={9} color={goal.achievedAt ? "var(--good)" : undefined}>
          {goal.achievedAt ? <Trophy size={26} color="var(--good)" /> : <span style={{ fontWeight: 900, fontSize: 18 }}>{Math.round(pct * 100)}%</span>}
        </ProgressRing>
        <div className="col grow" style={{ gap: 4, minWidth: 0 }}>
          <span className="eyebrow">{METRICS.find((m) => m.id === goal.metric)?.label}</span>
          <h3 style={{ fontSize: 20 }}>
            {goal.target}
            {unit} {ex?.name}
          </h3>
          <span className="small muted num">
            Current: {value}
            {unit} · started at {goal.baseline}
            {unit}
          </span>
          {daysLeft !== null && !goal.achievedAt && (
            <span className="small muted row" style={{ gap: 4 }}>
              <CalendarDays size={13} /> {daysLeft > 0 ? `${daysLeft} days left` : "Deadline passed"}
            </span>
          )}
        </div>
      </div>

      {plan && !goal.achievedAt && milestone && (
        <div className="card flat" style={{ padding: 12, background: "var(--accent-soft)", borderColor: "transparent" }}>
          <div className="row between">
            <span className="eyebrow" style={{ color: "var(--accent)" }}>
              This week's milestone
            </span>
            <span className="num" style={{ fontWeight: 800 }}>
              {milestone.target}
              {unit}
            </span>
          </div>
          <p className="small" style={{ marginTop: 4 }}>
            {milestone.description}
          </p>
        </div>
      )}

      <div className="row">
        {program && !goal.achievedAt && (
          <button className="btn sm primary grow" onClick={() => nav.push({ name: "program", id: program.id })}>
            Open plan <ChevronRight size={16} />
          </button>
        )}
        <button className="btn sm grow" onClick={() => setOpen(true)}>
          {plan ? "Details" : "Manage"}
        </button>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title={`${goal.target}${unit} ${ex?.name ?? ""}`}>
        <div className="col" style={{ gap: 16 }}>
          {plan ? (
            <>
              <div className="row between">
                <AIBadge label="AI PLAN" />
                <span className="chip" style={{ color: FEAS[plan.feasibility]?.color }}>
                  {FEAS[plan.feasibility]?.label}
                </span>
              </div>
              <p>{plan.summary}</p>
              {plan.feasibilityNote && <p className="small muted">{plan.feasibilityNote}</p>}
              <div className="col">
                <span className="eyebrow">Weekly milestones</span>
                <div className="list">
                  {plan.weeklyMilestones.map((m) => (
                    <div key={m.week} className="list-item" style={{ opacity: m.week < week ? 0.6 : 1 }}>
                      <span className={`check-dot ${value >= m.target ? "on" : m.week === week ? "next" : ""}`} style={{ fontSize: 11, fontWeight: 800 }}>
                        {m.week}
                      </span>
                      <div className="grow">
                        <div style={{ fontWeight: 700 }} className="num">
                          {m.target}
                          {unit}
                        </div>
                        <div className="small muted">{m.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {plan.tips.length > 0 && (
                <div className="col">
                  <span className="eyebrow">Coach tips</span>
                  <ul className="clean small">
                    {plan.tips.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="muted">No AI plan for this goal. Delete it and create a new one with AI to get a week-by-week plan.</p>
          )}
          <button
            className="btn block danger"
            onClick={() => {
              setState((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== goal.id) }));
              setOpen(false);
            }}
          >
            <Trash2 size={16} /> Delete goal
          </button>
        </div>
      </Sheet>
    </div>
  );
}

function NewGoalSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useAppState();
  const aiAvailable = useAIAvailable();
  const exercises = allExercises(state);
  const [exerciseId, setExerciseId] = useState("push-up");
  const [metric, setMetric] = useState<GoalMetric>("max_set");
  const [target, setTarget] = useState(100);
  const [baseline, setBaseline] = useState<number | "">("");
  const defaultDeadline = new Date(Date.now() + 42 * 86400000).toISOString().slice(0, 10);
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const ex = exercises.find((e) => e.id === exerciseId);
  const best = bestSet(state.logs, exerciseId);
  const base = baseline === "" ? (metric === "max_set" ? best : 0) : baseline;

  function reset() {
    setError("");
    setLoading(false);
    onClose();
  }

  async function create(withAI: boolean) {
    const goal: Goal = { id: uid(), exerciseId, metric, target, baseline: base, deadline: deadline || undefined, createdAt: Date.now() };
    if (withAI) {
      setLoading(true);
      setError("");
      try {
        const s = getState();
        const { plan } = await fetchGoalPlan({
          goal: { exercise: ex?.name, exerciseType: ex?.type, metric, target, baseline: base, deadline: deadline || null, today: new Date().toISOString().slice(0, 10) },
          profile: s.profile,
          history: historySummary(s),
        });
        const { program, ...rest } = plan;
        const programId = saveAIProgram(program, "ai-goal");
        goal.plan = { ...rest, programId };
        setState((st) => ({ ...st, active: st.active ?? { programId, completedDayIds: [], startedAt: Date.now() } }));
      } catch (e) {
        setError((e as Error).message);
        setLoading(false);
        return;
      }
    }
    setState((s) => ({ ...s, goals: [goal, ...s.goals] }));
    reset();
  }

  return (
    <Sheet open={open} onClose={loading ? () => {} : reset} title="New goal">
      {loading ? (
        <AILoading messages={["Analysing your baseline…", "Mapping weekly milestones…", "Building your training plan…", "Adding rest and test days…"]} />
      ) : (
        <div className="col" style={{ gap: 14 }}>
          <label className="field">
            Exercise
            <select className="input" value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
              {exercises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.emoji} {e.name}
                </option>
              ))}
            </select>
          </label>
          <div className="col" style={{ gap: 6 }}>
            <span className="small muted" style={{ fontWeight: 650 }}>
              Measure
            </span>
            <div className="seg">
              {METRICS.map((m) => (
                <button key={m.id} className={metric === m.id ? "on" : ""} onClick={() => setMetric(m.id)}>
                  {m.label}
                </button>
              ))}
            </div>
            <span className="small faint">{METRICS.find((m) => m.id === metric)?.hint}</span>
          </div>
          <div className="grid-2">
            <label className="field">
              Target {ex?.type === "time" ? "(seconds)" : "(reps)"}
              <input className="input num" type="number" inputMode="numeric" min={1} value={target} onChange={(e) => setTarget(Math.max(1, Number(e.target.value)))} />
            </label>
            <label className="field">
              Current best
              <input
                className="input num"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder={String(metric === "max_set" ? best : 0)}
                value={baseline}
                onChange={(e) => setBaseline(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
              />
            </label>
          </div>
          <label className="field">
            Deadline
            <input className="input" type="date" value={deadline} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDeadline(e.target.value)} />
          </label>
          {!aiAvailable && (
            <div className="banner">
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>AI plans need ANTHROPIC_API_KEY on the server. You can still track the goal without one.</span>
            </div>
          )}
          {error && <div className="banner error">{error}</div>}
          <button className="btn primary lg block" disabled={!aiAvailable} onClick={() => create(true)}>
            <Sparkles size={18} /> Create with AI plan
          </button>
          <button className="btn block" onClick={() => create(false)}>
            Just track it
          </button>
        </div>
      )}
    </Sheet>
  );
}
