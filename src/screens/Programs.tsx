import { useState } from "react";
import { Check, ChevronRight, Play, RotateCcw, Sparkles, Trash2, Plus } from "lucide-react";
import { AIBadge, Overlay, Sheet, setLabel } from "../components/ui";
import { allPrograms, findExercise, findProgram, missingEquipment, setState, useAppState } from "../store";
import { equipmentName } from "../data/equipment";
import { useNav } from "../nav";
import type { Program } from "../types";

export function Programs() {
  const state = useAppState();
  const nav = useNav();
  const programs = allPrograms(state);
  const active = findProgram(state.active?.programId, state);
  const mine = programs.filter((p) => p.source !== "builtin");
  const builtin = programs.filter((p) => p.source === "builtin");

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Programs</h1>
        <button className="btn sm primary" onClick={() => nav.push({ name: "import" })}>
          <Plus size={15} /> Add
        </button>
      </div>

      {active && state.active && (
        <>
          <span className="eyebrow">Active challenge</span>
          <ProgramCard program={active} progress={state.active.completedDayIds.length / active.days.length} onOpen={() => nav.push({ name: "program", id: active.id })} />
        </>
      )}

      <button className="card tap row" onClick={() => nav.push({ name: "import" })} style={{ borderStyle: "dashed", boxShadow: "none" }}>
        <div className="emoji-badge" style={{ background: "linear-gradient(135deg, var(--violet), var(--blue))" }}>
          <Sparkles color="#fff" size={22} />
        </div>
        <div className="grow">
          <div style={{ fontWeight: 750 }}>Add a program with Claude</div>
          <div className="small muted">Claude converts your program file in the Claude app, then you paste it here. No API key needed.</div>
        </div>
        <ChevronRight className="faint" />
      </button>

      {mine.length > 0 && (
        <>
          <div className="section-title">
            <h2>My programs</h2>
          </div>
          {mine.map((p) => (
            <ProgramCard key={p.id} program={p} onOpen={() => nav.push({ name: "program", id: p.id })} />
          ))}
        </>
      )}

      <div className="section-title">
        <h2>Challenges</h2>
      </div>
      {builtin.map((p) => (
        <ProgramCard key={p.id} program={p} onOpen={() => nav.push({ name: "program", id: p.id })} />
      ))}
    </div>
  );
}

function ProgramCard({ program, progress, onOpen }: { program: Program; progress?: number; onOpen: () => void }) {
  const missing = missingEquipment(program);
  const exercises = [...new Set(program.days.flatMap((d) => d.items.map((i) => i.exerciseId)))];
  return (
    <button className="card tap col" style={{ gap: 10, borderLeft: `5px solid ${program.color}` }} onClick={onOpen}>
      <div className="row between" style={{ alignItems: "flex-start" }}>
        <div className="col grow" style={{ gap: 4 }}>
          <h3 style={{ fontSize: 18 }}>{program.name}</h3>
          <p className="small muted" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {program.description}
          </p>
        </div>
        <div className="row" style={{ gap: 2 }}>
          {exercises.slice(0, 3).map((id) => (
            <span key={id} style={{ fontSize: 20 }}>
              {findExercise(id)?.emoji}
            </span>
          ))}
        </div>
      </div>
      <div className="chips">
        <span className="chip">{program.durationWeeks} weeks</span>
        <span className="chip">{program.days.length} sessions</span>
        <span className="chip" style={{ textTransform: "capitalize" }}>
          {program.level}
        </span>
        {program.source !== "builtin" && <AIBadge label={program.source === "ai-goal" ? "AI PLAN" : "AI IMPORT"} />}
      </div>
      {missing.length > 0 && (
        <span className="small" style={{ color: "var(--warn)", fontWeight: 650 }}>
          Needs {missing.map(equipmentName).join(", ")}
        </span>
      )}
      {progress !== undefined && (
        <div className="bar">
          <div style={{ width: `${progress * 100}%` }} />
        </div>
      )}
    </button>
  );
}

export function ProgramDetail({ id }: { id: string }) {
  const state = useAppState();
  const nav = useNav();
  const program = findProgram(id, state);
  const [confirm, setConfirm] = useState<"delete" | "switch" | "restart" | null>(null);
  if (!program) return <Overlay title="Program">Program not found.</Overlay>;

  const isActive = state.active?.programId === program.id;
  const completed = new Set(isActive ? state.active!.completedDayIds : []);
  const nextDay = program.days.find((d) => !completed.has(d.id));
  const weeks = [...new Set(program.days.map((d) => d.week))];

  function activate() {
    setState((s) => ({ ...s, active: { programId: program!.id, completedDayIds: [], startedAt: Date.now() } }));
    setConfirm(null);
  }

  function remove() {
    setState((s) => ({
      ...s,
      programs: s.programs.filter((p) => p.id !== program!.id),
      active: s.active?.programId === program!.id ? null : s.active,
    }));
    setConfirm(null);
    nav.pop();
  }

  return (
    <Overlay
      title={program.name}
      right={
        program.source !== "builtin" ? (
          <button className="icon-btn" onClick={() => setConfirm("delete")} aria-label="Delete program">
            <Trash2 size={18} color="var(--bad)" />
          </button>
        ) : undefined
      }
    >
      <div className="card hero" style={{ background: `linear-gradient(135deg, ${program.color}, #ff9f1c)` }}>
        <div className="col" style={{ gap: 8, position: "relative", zIndex: 1 }}>
          <span className="eyebrow" style={{ color: "rgba(255,255,255,.85)" }}>
            Goal
          </span>
          <h2 style={{ fontSize: 24, fontWeight: 900 }}>{program.goal}</h2>
          <p className="muted">{program.description}</p>
          <div className="row" style={{ gap: 18, marginTop: 6 }}>
            <Stat v={program.durationWeeks} l="weeks" />
            <Stat v={program.daysPerWeek} l="days / wk" />
            <Stat v={program.days.length} l="sessions" />
          </div>
        </div>
      </div>

      {isActive ? (
        nextDay ? (
          <button className="btn primary lg block" onClick={() => nav.push({ name: "workout", programId: program.id, dayId: nextDay.id })}>
            <Play size={18} fill="#fff" /> Start {nextDay.title}
          </button>
        ) : (
          <div className="banner" style={{ color: "var(--good)", background: "var(--good-soft)" }}>
            Program complete. Amazing work!
          </div>
        )
      ) : (
        <button className="btn primary lg block" onClick={() => (state.active ? setConfirm("switch") : activate())}>
          <Check size={18} /> Start this program
        </button>
      )}
      {isActive && completed.size > 0 && (
        <button className="btn sm ghost" onClick={() => setConfirm("restart")}>
          <RotateCcw size={14} /> Restart program from Week 1
        </button>
      )}

      {program.notes.length > 0 && (
        <div className="card flat col">
          <span className="eyebrow">Program notes</span>
          <ul className="clean small">
            {program.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      {weeks.map((w) => (
        <div key={w} className="col">
          <span className="eyebrow">Week {w}</span>
          <div className="card flat list" style={{ padding: "4px 16px" }}>
            {program.days
              .filter((d) => d.week === w)
              .map((d) => {
                const done = completed.has(d.id);
                const isNext = isActive && d.id === nextDay?.id;
                return (
                  <button key={d.id} className="list-item" onClick={() => nav.push({ name: "workout", programId: program.id, dayId: d.id })}>
                    <span className={`check-dot ${done ? "on" : isNext ? "next" : ""}`}>{done ? <Check size={16} /> : isNext ? <Play size={12} fill="currentColor" /> : null}</span>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{d.title}</div>
                      <div className="small muted ellipsis">
                        {d.items
                          .map((it) => {
                            const ex = findExercise(it.exerciseId, state);
                            return `${ex?.name ?? it.exerciseId} ${it.sets.map((s) => setLabel(s, ex?.type ?? "reps")).join("-")}`;
                          })
                          .join(" · ")}
                      </div>
                    </div>
                    <ChevronRight size={18} className="faint" />
                  </button>
                );
              })}
          </div>
        </div>
      ))}

      <Sheet open={confirm === "restart"} onClose={() => setConfirm(null)} title="Restart program?">
        <div className="col" style={{ gap: 10 }}>
          <p className="muted">All sessions are marked as not done and you start again from Week 1. Your workout history, streaks and records stay.</p>
          <button className="btn primary block" onClick={activate}>
            Restart from Week 1
          </button>
          <button className="btn ghost block" onClick={() => setConfirm(null)}>
            Cancel
          </button>
        </div>
      </Sheet>
      <Sheet open={confirm === "switch"} onClose={() => setConfirm(null)} title="Switch program?">
        <div className="col" style={{ gap: 10 }}>
          <p className="muted">Your current program's progress will be replaced. Your workout history stays.</p>
          <button className="btn primary block" onClick={activate}>
            Switch to {program.name}
          </button>
          <button className="btn ghost block" onClick={() => setConfirm(null)}>
            Cancel
          </button>
        </div>
      </Sheet>
      <Sheet open={confirm === "delete"} onClose={() => setConfirm(null)} title="Delete program?">
        <div className="col" style={{ gap: 10 }}>
          <p className="muted">This removes the program. Logged workouts are kept.</p>
          <button className="btn block danger" onClick={remove}>
            Delete
          </button>
          <button className="btn ghost block" onClick={() => setConfirm(null)}>
            Cancel
          </button>
        </div>
      </Sheet>
    </Overlay>
  );
}

function Stat({ v, l }: { v: number; l: string }) {
  return (
    <div className="col" style={{ gap: 0 }}>
      <span className="num" style={{ fontSize: 22, fontWeight: 900 }}>
        {v}
      </span>
      <span className="small muted">{l}</span>
    </div>
  );
}
