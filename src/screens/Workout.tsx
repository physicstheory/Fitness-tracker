import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, Minus, Music, Pause, Play, Plus, SkipForward, Trophy, X } from "lucide-react";
import { Confetti, ProgressRing, Sheet, setLabel } from "../components/ui";
import { ExerciseGuide } from "../components/ExerciseGuide";
import { WorkoutMusic, useSpotifyConnected } from "../components/Music";
import { feedback, unlockAudio } from "../lib/feedback";
import { fmtDuration, fmtTime, goalProgress } from "../lib/stats";
import { findExercise, findProgram, getState, setState, uid, useAppState } from "../store";
import { useNav } from "../nav";
import { useNow, useWakeLock } from "../hooks";
import type { Exercise, ProgramItem, WorkoutLog } from "../types";

type Phase = "intro" | "active" | "rest" | "summary";
interface Pos {
  i: number;
  s: number;
}

export function Workout({ programId, dayId, exerciseId }: { programId?: string; dayId?: string; exerciseId?: string }) {
  const nav = useNav();
  const state = useAppState();
  const program = findProgram(programId, state);
  const day = program?.days.find((d) => d.id === dayId);

  const [items, setItems] = useState<ProgramItem[]>(() => {
    if (day) return day.items.map((it) => ({ ...it, sets: [...it.sets] }));
    const ex = exerciseId ? findExercise(exerciseId, state) : undefined;
    return ex ? [{ exerciseId: ex.id, sets: [0, 0, 0], restSec: ex.defaultRestSec, notes: ex.type === "time" ? "Free session: hold as long as you can each set." : "Free session: log as many reps as you like each set." }] : [];
  });
  const title = day ? `${program!.name} · ${day.title}` : `${findExercise(items[0]?.exerciseId ?? "")?.name ?? "Quick"} session`;

  const [results, setResults] = useState<(number | undefined)[][]>(() => items.map((it) => it.sets.map(() => undefined)));
  const [phase, setPhase] = useState<Phase>("intro");
  const [pos, setPos] = useState<Pos>({ i: 0, s: 0 });
  const [count, setCount] = useState(0);
  const [pulse, setPulse] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [restEndsAt, setRestEndsAt] = useState(0);
  const [restTotal, setRestTotal] = useState(0);
  // Timed sets
  const [readyEndsAt, setReadyEndsAt] = useState(0);
  const [timerStart, setTimerStart] = useState(0);
  const [paused, setPaused] = useState<number | null>(null); // elapsed ms when paused
  const [showGuide, setShowGuide] = useState(false);
  const [showMusic, setShowMusic] = useState(true);
  const hasMusic = useSpotifyConnected() || Boolean(state.settings.workoutMusic);
  const [confirmExit, setConfirmExit] = useState(false);
  const [feeling, setFeeling] = useState<WorkoutLog["feeling"]>();
  const [celebrate, setCelebrate] = useState(false);
  const [newGoals, setNewGoals] = useState<string[]>([]);
  const lastTick = useRef(-1);

  const item = items[pos.i];
  const exercise = item ? findExercise(item.exerciseId, state) : undefined;
  const target = item?.sets[pos.s] ?? 0;
  const isTime = exercise?.type === "time";

  const timing = phase === "rest" || (phase === "active" && isTime && (readyEndsAt > 0 || timerStart > 0));
  const now = useNow(timing || phase === "active", 100);
  useWakeLock(phase === "active" || phase === "rest");

  const next = useCallback(
    (p: Pos): Pos | null => {
      if (p.s + 1 < items[p.i].sets.length) return { i: p.i, s: p.s + 1 };
      if (p.i + 1 < items.length) return { i: p.i + 1, s: 0 };
      return null;
    },
    [items],
  );

  const resetSet = () => {
    setCount(0);
    setReadyEndsAt(0);
    setTimerStart(0);
    setPaused(null);
    lastTick.current = -1;
  };

  const completeSet = useCallback(
    (actual: number) => {
      setResults((r) => r.map((row, i) => (i === pos.i ? row.map((v, s) => (s === pos.s ? actual : v)) : row)));
      feedback.done();
      const n = next(pos);
      resetSet();
      if (!n) {
        setPhase("summary");
        return;
      }
      setPos(n);
      const rest = items[pos.i].restSec;
      if (rest > 0 && getState().settings.autoStartRest) {
        setRestTotal(rest);
        setRestEndsAt(Date.now() + rest * 1000);
        setPhase("rest");
      }
    },
    [items, next, pos],
  );

  // Rest countdown + timed set countdown.
  useEffect(() => {
    if (phase === "rest") {
      const left = Math.ceil((restEndsAt - now) / 1000);
      if (left <= 3 && left > 0 && left !== lastTick.current) {
        lastTick.current = left;
        feedback.tick();
      }
      if (now >= restEndsAt) {
        lastTick.current = -1;
        feedback.done();
        setPhase("active");
      }
      return;
    }
    if (phase !== "active" || !isTime) return;
    if (readyEndsAt) {
      const left = Math.ceil((readyEndsAt - now) / 1000);
      if (left > 0 && left !== lastTick.current) {
        lastTick.current = left;
        feedback.tick();
      }
      if (now >= readyEndsAt) {
        setReadyEndsAt(0);
        setTimerStart(Date.now());
        lastTick.current = -1;
        feedback.tap();
      }
      return;
    }
    if (timerStart && paused === null && target > 0) {
      const left = Math.ceil((timerStart + target * 1000 - now) / 1000);
      if (left <= 3 && left > 0 && left !== lastTick.current) {
        lastTick.current = left;
        feedback.tick();
      }
      if (left <= 0) completeSet(target);
    }
  }, [now, phase, restEndsAt, readyEndsAt, timerStart, paused, target, isTime, completeSet]);

  // Keyboard: space/enter counts a rep on desktop.
  useEffect(() => {
    if (phase !== "active" || isTime) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        addRep();
      } else if (e.code === "ArrowDown") setCount((c) => Math.max(0, c - 1));
      else if (e.code === "Enter") completeSet(count);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function addRep() {
    setCount((c) => {
      const n = c + 1;
      if (target > 0 && n === target) feedback.done();
      else feedback.tap();
      return n;
    });
    setPulse(true);
    setTimeout(() => setPulse(false), 90);
  }

  function start() {
    unlockAudio();
    setStartedAt(Date.now());
    setPhase("active");
  }

  function addSet() {
    setItems((its) => its.map((it, i) => (i === pos.i ? { ...it, sets: [...it.sets, it.sets[it.sets.length - 1] ?? 0] } : it)));
    setResults((r) => r.map((row, i) => (i === pos.i ? [...row, undefined] : row)));
  }

  const elapsedTimed = timerStart ? (paused ?? now - timerStart) / 1000 : 0;
  const totalDone = results.flat().reduce<number>((a, v) => a + (v ?? 0), 0);
  const durationSec = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;

  function save() {
    const log: WorkoutLog = {
      id: uid(),
      date: new Date().toISOString(),
      programId: day ? programId : undefined,
      dayId: day ? dayId : undefined,
      title,
      durationSec,
      feeling,
      entries: items
        .map((it, i) => ({
          exerciseId: it.exerciseId,
          sets: it.sets.flatMap((t, s) => (results[i][s] === undefined ? [] : [{ target: t, actual: results[i][s]! }])),
        }))
        .filter((e) => e.sets.length),
    };
    const before = getState();
    const pending = before.goals.filter((g) => !g.achievedAt);
    setState((s) => {
      const logs = [log, ...s.logs];
      const goals = s.goals.map((g) => (!g.achievedAt && goalProgress(g, logs) >= g.target ? { ...g, achievedAt: Date.now() } : g));
      let active = s.active;
      if (day && programId) {
        if (!active || active.programId !== programId) active = { programId, completedDayIds: [], startedAt: Date.now() };
        if (!active.completedDayIds.includes(day.id)) active = { ...active, completedDayIds: [...active.completedDayIds, day.id] };
      }
      return { ...s, logs, goals, active };
    });
    const achieved = getState().goals.filter((g) => g.achievedAt && pending.some((p) => p.id === g.id));
    if (achieved.length) {
      setNewGoals(achieved.map((g) => `${g.target} ${findExercise(g.exerciseId)?.name ?? ""}`));
      setCelebrate(true);
      feedback.celebrate();
      setTimeout(() => nav.pop(), 3200);
    } else nav.pop();
  }

  if (!items.length) {
    return (
      <div className="overlay">
        <div className="player">
          <button className="icon-btn" onClick={nav.pop}>
            <X size={20} />
          </button>
          <p className="muted">This workout could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay">
      <div className={`overlay-inner ${phase === "rest" ? "rest-screen" : ""}`}>
        <div className="player">
          <div className="row between">
            <button className="icon-btn" onClick={() => (phase === "intro" ? nav.pop() : phase === "summary" ? nav.pop() : setConfirmExit(true))} aria-label="Close">
              <X size={20} />
            </button>
            <div className="col grow" style={{ gap: 0, alignItems: "center" }}>
              <span className="eyebrow ellipsis" style={{ maxWidth: "100%" }}>
                {program?.name ?? "Quick workout"}
              </span>
              {startedAt > 0 && phase !== "summary" && <span className="num small muted">{fmtTime((now - startedAt) / 1000)}</span>}
            </div>
            {hasMusic && (
              <button
                className="icon-btn"
                onClick={() => setShowMusic((v) => !v)}
                aria-label={showMusic ? "Hide music" : "Show music"}
                style={showMusic ? { background: "#1db954", borderColor: "#1db954", color: "#fff" } : undefined}
              >
                <Music size={18} />
              </button>
            )}
            <button className="icon-btn" onClick={() => setShowGuide(true)} aria-label="How to" disabled={!exercise}>
              <BookOpen size={18} />
            </button>
          </div>

          <WorkoutMusic visible={showMusic} autoStart={startedAt > 0} />

          {phase === "intro" && <Intro title={day?.title ?? title} focus={day?.focus} items={items} onStart={start} />}

          {(phase === "active" || phase === "rest") && exercise && item && (
            <>
              <div className="col" style={{ gap: 10 }}>
                <div className="row">
                  <span style={{ fontSize: 28 }}>{exercise.emoji}</span>
                  <div className="col grow" style={{ gap: 0 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 800 }}>{exercise.name}</h2>
                    <span className="small muted">
                      Exercise {pos.i + 1} of {items.length} · Set {pos.s + 1} of {item.sets.length}
                    </span>
                  </div>
                </div>
                <div className="set-chips">
                  {item.sets.map((t, s) => {
                    const r = results[pos.i][s];
                    const cls = s === pos.s ? "current" : r === undefined ? "" : t > 0 && r < t ? "missed" : "done";
                    return (
                      <div key={s} className={`set-chip ${cls}`}>
                        <span className="num">{r ?? setLabel(t, exercise.type)}</span>
                        {r !== undefined && <small>/{setLabel(t, exercise.type)}</small>}
                      </div>
                    );
                  })}
                  <button className="set-chip" onClick={addSet} aria-label="Add set">
                    <Plus size={18} />
                  </button>
                </div>
              </div>

              {phase === "rest" ? (
                <Rest
                  left={(restEndsAt - now) / 1000}
                  total={restTotal}
                  upNext={exercise}
                  upNextTarget={target}
                  onAdd={(n) => {
                    setRestEndsAt((e) => e + n * 1000);
                    setRestTotal((t) => t + n);
                  }}
                  onSkip={() => setPhase("active")}
                />
              ) : isTime ? (
                <TimedSet
                  target={target}
                  elapsed={elapsedTimed}
                  readyLeft={readyEndsAt ? Math.ceil((readyEndsAt - now) / 1000) : 0}
                  running={timerStart > 0}
                  paused={paused !== null}
                  onStart={() => {
                    unlockAudio();
                    lastTick.current = -1;
                    setReadyEndsAt(Date.now() + 3000);
                  }}
                  onPause={() => setPaused(now - timerStart)}
                  onResume={() => {
                    setTimerStart(Date.now() - (paused ?? 0));
                    setPaused(null);
                  }}
                  onStop={() => completeSet(Math.round(elapsedTimed))}
                />
              ) : (
                <>
                  <div className="tap-zone" onPointerDown={(e) => (e.preventDefault(), addRep())}>
                    <div className={`tap-circle ${pulse ? "pulse" : ""}`}>
                      <span className="count num">{count}</span>
                      <span className="of">{target > 0 ? `of ${target}` : "max effort"}</span>
                      {count === 0 && <span className="hint">Tap to count</span>}
                    </div>
                  </div>
                  {target > 0 && <div className="bar"><div style={{ width: `${Math.min(100, (count / target) * 100)}%` }} /></div>}
                  <div className="row">
                    <button className="icon-btn" style={{ width: 58, height: 58 }} onClick={() => setCount((c) => Math.max(0, c - 1))} aria-label="Minus one">
                      <Minus size={22} />
                    </button>
                    <button className="btn primary lg grow" onClick={() => completeSet(count)}>
                      <Check size={20} /> {count >= target || target === 0 ? "Set done" : `Finish at ${count}`}
                    </button>
                    {target > 0 && (
                      <button className="icon-btn" style={{ width: 58, height: 58, fontWeight: 800 }} onClick={() => setCount(target)} aria-label="Fill target">
                        {target}
                      </button>
                    )}
                  </div>
                </>
              )}
              {item.notes && phase === "active" && <p className="small muted" style={{ textAlign: "center" }}>{item.notes}</p>}
            </>
          )}

          {phase === "summary" && (
            <div className="col" style={{ gap: 18, flex: 1 }}>
              <div className="col" style={{ alignItems: "center", textAlign: "center", gap: 6, padding: "18px 0 6px" }}>
                <div className="emoji-badge" style={{ width: 72, height: 72, fontSize: 36, background: "var(--grad)" }}>
                  <Trophy color="#fff" size={34} />
                </div>
                <h1 style={{ fontSize: 30, fontWeight: 900 }}>Workout complete!</h1>
                <p className="muted">{day?.title ?? title}</p>
              </div>
              <div className="grid-3">
                <div className="stat">
                  <span className="value num">{totalDone}</span>
                  <span className="label">{items.every((i) => findExercise(i.exerciseId)?.type === "time") ? "Seconds" : "Total reps"}</span>
                </div>
                <div className="stat">
                  <span className="value num">{results.flat().filter((v) => v !== undefined).length}</span>
                  <span className="label">Sets</span>
                </div>
                <div className="stat">
                  <span className="value num">{fmtDuration(durationSec)}</span>
                  <span className="label">Time</span>
                </div>
              </div>
              <div className="card flat list">
                {items.map((it, i) => {
                  const ex = findExercise(it.exerciseId);
                  return (
                    <div key={i} className="list-item">
                      <span className="emoji-badge">{ex?.emoji}</span>
                      <div className="grow">
                        <div style={{ fontWeight: 700 }}>{ex?.name}</div>
                        <div className="small muted num">
                          {it.sets.map((_, s) => (results[i][s] === undefined ? "–" : `${results[i][s]}${ex?.type === "time" ? "s" : ""}`)).join(" · ")}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="col">
                <span className="eyebrow">How did that feel?</span>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  {(["😫", "😓", "🙂", "😀", "🔥"] as const).map((e, i) => (
                    <button
                      key={e}
                      className="emoji-badge"
                      style={{ fontSize: 26, width: 54, height: 54, outline: feeling === i + 1 ? "2px solid var(--accent)" : "none" }}
                      onClick={() => setFeeling((i + 1) as WorkoutLog["feeling"])}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              {newGoals.length > 0 && (
                <div className="card hero">
                  <h3>🎉 Goal achieved!</h3>
                  <p className="muted">{newGoals.join(", ")}</p>
                </div>
              )}
              <div style={{ flex: 1 }} />
              <button className="btn primary lg block" onClick={save} disabled={totalDone === 0 && !results.flat().some((v) => v !== undefined)}>
                Save workout
              </button>
              <button className="btn ghost block danger" onClick={nav.pop}>
                Discard
              </button>
            </div>
          )}
        </div>
      </div>

      <Sheet open={showGuide} onClose={() => setShowGuide(false)} title={exercise?.name}>
        {exercise && <ExerciseGuide exercise={exercise} compact />}
      </Sheet>
      <Sheet open={confirmExit} onClose={() => setConfirmExit(false)} title="End workout?">
        <div className="col" style={{ gap: 10 }}>
          <p className="muted">You can save the sets you've done so far or discard this session.</p>
          <button
            className="btn primary block"
            onClick={() => {
              setConfirmExit(false);
              setPhase("summary");
            }}
          >
            Finish & review
          </button>
          <button className="btn block danger" onClick={nav.pop}>
            Discard workout
          </button>
          <button className="btn ghost block" onClick={() => setConfirmExit(false)}>
            Keep going
          </button>
        </div>
      </Sheet>
      <Confetti show={celebrate} />
    </div>
  );
}

function Intro({ title, focus, items, onStart }: { title: string; focus?: string; items: ProgramItem[]; onStart: () => void }) {
  const total = items.reduce((a, it) => a + it.sets.reduce((x, y) => x + y, 0), 0);
  const exercises = useMemo(() => items.map((it) => findExercise(it.exerciseId)), [items]);
  return (
    <div className="col" style={{ gap: 18, flex: 1 }}>
      <div className="col" style={{ gap: 6, paddingTop: 10 }}>
        <h1 style={{ fontSize: 30, fontWeight: 900 }}>{title}</h1>
        {focus && <p className="muted">{focus}</p>}
      </div>
      <div className="grid-3">
        <div className="stat">
          <span className="value num">{items.length}</span>
          <span className="label">Exercises</span>
        </div>
        <div className="stat">
          <span className="value num">{items.reduce((a, it) => a + it.sets.length, 0)}</span>
          <span className="label">Sets</span>
        </div>
        <div className="stat">
          <span className="value num">{total || "MAX"}</span>
          <span className="label">Target{total ? "+" : ""}</span>
        </div>
      </div>
      <div className="card flat list">
        {items.map((it, i) => {
          const ex = exercises[i];
          return (
            <div key={i} className="list-item">
              <span className="emoji-badge">{ex?.emoji ?? "🏋️"}</span>
              <div className="grow">
                <div style={{ fontWeight: 700 }}>{ex?.name ?? it.exerciseId}</div>
                <div className="chips" style={{ marginTop: 4 }}>
                  {it.sets.map((t, s) => (
                    <span key={s} className="chip num">
                      {setLabel(t, ex?.type ?? "reps")}
                    </span>
                  ))}
                </div>
              </div>
              <span className="small faint">{it.restSec}s rest</span>
            </div>
          );
        })}
      </div>
      <div style={{ flex: 1 }} />
      <button className="btn primary lg block" onClick={onStart}>
        <Play size={20} fill="#fff" /> Start workout
      </button>
    </div>
  );
}

function Rest({
  left,
  total,
  upNext,
  upNextTarget,
  onAdd,
  onSkip,
}: {
  left: number;
  total: number;
  upNext: Exercise;
  upNextTarget: number;
  onAdd: (n: number) => void;
  onSkip: () => void;
}) {
  return (
    <div className="col" style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 22 }}>
      <span className="eyebrow" style={{ color: "var(--blue)" }}>
        Rest & recover
      </span>
      <ProgressRing value={total ? left / total : 0} size={Math.min(280, window.innerWidth * 0.7)} stroke={14} color="var(--blue)">
        <span className="big-time num">{fmtTime(Math.ceil(left))}</span>
        <span className="small muted">of {fmtTime(total)}</span>
      </ProgressRing>
      <div className="row">
        <button className="btn" onClick={() => onAdd(-15)} disabled={left < 16}>
          −15s
        </button>
        <button className="btn" onClick={() => onAdd(15)}>
          +15s
        </button>
        <button className="btn primary" onClick={onSkip}>
          <SkipForward size={18} /> Skip
        </button>
      </div>
      <div className="card flat row" style={{ width: "100%" }}>
        <span className="emoji-badge">{upNext.emoji}</span>
        <div className="grow">
          <span className="eyebrow">Up next</span>
          <div style={{ fontWeight: 700 }}>
            {upNext.name} · {setLabel(upNextTarget, upNext.type)}
            {upNext.type === "reps" && upNextTarget > 0 ? " reps" : ""}
          </div>
        </div>
      </div>
    </div>
  );
}

function TimedSet({
  target,
  elapsed,
  readyLeft,
  running,
  paused,
  onStart,
  onPause,
  onResume,
  onStop,
}: {
  target: number;
  elapsed: number;
  readyLeft: number;
  running: boolean;
  paused: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  const size = Math.min(290, window.innerWidth * 0.72);
  const shown = target > 0 ? Math.max(0, target - elapsed) : elapsed;
  return (
    <div className="col" style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 24 }}>
      <ProgressRing value={readyLeft ? readyLeft / 3 : target > 0 ? elapsed / target : (elapsed % 60) / 60} size={size} stroke={14}>
        {readyLeft > 0 ? (
          <>
            <span className="eyebrow">Get ready</span>
            <span className="big-time num" style={{ color: "var(--accent)" }}>
              {readyLeft}
            </span>
          </>
        ) : (
          <>
            <span className="big-time num">{fmtTime(target > 0 ? Math.ceil(shown) : Math.floor(shown))}</span>
            <span className="small muted">{target > 0 ? `hold for ${target}s` : "hold as long as you can"}</span>
          </>
        )}
      </ProgressRing>
      {!running && !readyLeft ? (
        <button className="btn primary lg block" onClick={onStart}>
          <Play size={20} fill="#fff" /> Start {target > 0 ? `${target}s` : "timer"}
        </button>
      ) : running ? (
        <div className="row" style={{ width: "100%" }}>
          <button className="icon-btn" style={{ width: 58, height: 58 }} onClick={paused ? onResume : onPause} aria-label={paused ? "Resume" : "Pause"}>
            {paused ? <Play size={22} /> : <Pause size={22} />}
          </button>
          <button className="btn primary lg grow" onClick={onStop}>
            <Check size={20} /> {target > 0 ? "Stop early" : "Stop & log"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
