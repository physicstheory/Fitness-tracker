import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, Hand, Minus, Music, Pause, Play, Plus, RotateCcw, Save, SkipForward, Square, Timer, Trophy, X } from "lucide-react";
import { Confetti, ProgressRing, Sheet, setLabel } from "../components/ui";
import { ExerciseGuide } from "../components/ExerciseGuide";
import { WorkoutMusic, useSpotifyConnected } from "../components/Music";
import { feedback, unlockAudio } from "../lib/feedback";
import { fmtDuration, fmtTime, goalProgress, lastWeight } from "../lib/stats";
import { ExerciseVisual } from "../components/ExerciseVisual";
import { equipmentName } from "../data/equipment";
import { canDo, findExercise, findProgram, getState, setState, uid, useAppState } from "../store";
import { useNav } from "../nav";
import { useNow, useWakeLock } from "../hooks";
import type { Exercise, ProgramItem, SavedWorkout, Settings, WorkoutLog } from "../types";

type Phase = "intro" | "active" | "rest" | "summary";
interface Pos {
  i: number;
  s: number;
}

const DEFAULT_PACE = 2.5;

/** Seconds per rep for auto counting. */
function paceFor(exerciseId: string, settings: Settings, repPace: Record<string, number>): number {
  if (settings.autoPace === "fixed") return Math.max(0.5, settings.autoPaceSec);
  return repPace[exerciseId] ?? DEFAULT_PACE;
}

export function Workout({ programId, dayId, exerciseId, resume }: { programId?: string; dayId?: string; exerciseId?: string; resume?: boolean }) {
  const nav = useNav();
  const state = useAppState();
  // When resuming, everything is restored from the saved snapshot taken at mount.
  const [saved] = useState<SavedWorkout | undefined>(() => (resume ? getState().inProgress : undefined));
  const pid = saved ? saved.programId : programId;
  const did = saved ? saved.dayId : dayId;
  const program = findProgram(pid, state);
  const day = program?.days.find((d) => d.id === did);

  const [items, setItems] = useState<ProgramItem[]>(() => {
    if (saved) return saved.items;
    if (day) return day.items.map((it) => ({ ...it, sets: [...it.sets] }));
    const ex = exerciseId ? findExercise(exerciseId, state) : undefined;
    return ex
      ? [{ exerciseId: ex.id, sets: [0, 0, 0], restSec: ex.defaultRestSec, notes: ex.type === "time" ? "Free session: hold as long as you can each set." : "Free session: log as many reps as you like each set." }]
      : [];
  });
  const title = saved?.title ?? (day ? `${program!.name} · ${day.title}` : `${findExercise(items[0]?.exerciseId ?? "")?.name ?? "Quick"} session`);

  const [results, setResults] = useState<(number | undefined)[][]>(() =>
    saved ? saved.results.map((row) => row.map((v) => (v === null ? undefined : v))) : items.map((it) => it.sets.map(() => undefined)),
  );
  const [weights, setWeights] = useState<(number | undefined)[][]>(() =>
    saved?.weights ? saved.weights.map((row) => row.map((v) => (v === null ? undefined : v))) : items.map((it) => it.sets.map(() => undefined)),
  );
  const [phase, setPhase] = useState<Phase>(saved?.phase ?? "intro");
  const [pos, setPos] = useState<Pos>(saved?.pos ?? { i: 0, s: 0 });
  const [count, setCount] = useState(saved?.count ?? 0);
  const [pulse, setPulse] = useState(false);
  const [startedAt, setStartedAt] = useState(() => (saved ? Date.now() - saved.elapsedMs : 0));
  const [restEndsAt, setRestEndsAt] = useState(0);
  const [restTotal, setRestTotal] = useState(saved?.restTotal ?? 0);
  // Rest timer paused on its own (ms left), separate from pausing the whole workout.
  const [restHold, setRestHold] = useState<number | null>(null);
  // Timer used by timed holds and by auto rep counting.
  const [readyEndsAt, setReadyEndsAt] = useState(0);
  const [timerStart, setTimerStart] = useState(0);
  const [paused, setPaused] = useState<number | null>(null); // elapsed ms when paused
  const [repOffset, setRepOffset] = useState(0); // manual corrections while auto counting
  // Whole-workout pause: freezes the workout clock, rest timer and timers. A resumed workout opens paused.
  const [pausedAt, setPausedAt] = useState<number | null>(() => (saved ? Date.now() : null));
  const [pausedTotal, setPausedTotal] = useState(0);
  const [restLeftAtPause, setRestLeftAtPause] = useState(saved?.restLeftMs ?? 0);
  const [timedPausedByUs, setTimedPausedByUs] = useState(false);
  const [repMode, setRepMode] = useState(state.settings.repMode);
  const [paceOverride, setPaceOverride] = useState<number | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showMusic, setShowMusic] = useState(true);
  const hasMusic = useSpotifyConnected() || Boolean(state.settings.workoutMusic);
  const [confirmExit, setConfirmExit] = useState(false);
  const [feeling, setFeeling] = useState<WorkoutLog["feeling"]>();
  const [celebrate, setCelebrate] = useState(false);
  const [newGoals, setNewGoals] = useState<string[]>([]);
  const lastTick = useRef(-1);
  const tapTimes = useRef<number[]>([]);

  const item = items[pos.i];
  const exercise = item ? findExercise(item.exerciseId, state) : undefined;
  const target = item?.sets[pos.s] ?? 0;
  const isTime = exercise?.type === "time";
  const isAuto = !isTime && repMode === "auto";
  const usesTimer = isTime || isAuto;
  const pace = paceOverride ?? (item ? paceFor(item.exerciseId, state.settings, state.repPace) : DEFAULT_PACE);

  const timing = phase === "rest" || (phase === "active" && usesTimer && (readyEndsAt > 0 || timerStart > 0));
  const now = useNow(timing || phase === "active" || pausedAt !== null, 100);
  useWakeLock((phase === "active" || phase === "rest") && pausedAt === null);

  // Weight for the current set: program target, else the previous set, else what you used last time.
  const isWeighted = Boolean(exercise?.weighted) && !isTime;
  const defaultWeight = (p: Pos): number => {
    const it = items[p.i];
    if (!it) return 0;
    return it.weights?.[p.s] ?? weights[p.i]?.[p.s - 1] ?? weights[p.i]?.find((w) => w !== undefined) ?? lastWeight(getState().logs, it.exerciseId) ?? 0;
  };
  const [curWeight, setCurWeight] = useState(() => defaultWeight(saved?.pos ?? { i: 0, s: 0 }));
  useEffect(() => {
    setCurWeight(defaultWeight(pos));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.i, pos.s]);
  const units = state.settings.units;
  const heavyKit = (exercise?.equipmentIds ?? []).some((id) => id === "barbell" || id === "leg_press" || id === "cable");
  const weightStep = units === "kg" ? (heavyKit ? 2.5 : 1) : heavyKit ? 5 : 2.5;

  const elapsedTimed = timerStart ? (paused ?? now - timerStart) / 1000 : 0;
  const autoCount = Math.max(0, Math.floor(elapsedTimed / pace) + repOffset);
  const shownCount = isAuto ? autoCount : count;

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
    setRepOffset(0);
    tapTimes.current = [];
    lastTick.current = -1;
  };

  /** Learns the user's pace from manually tapped sets, for "average" auto counting. */
  const learnPace = useCallback((exId: string) => {
    const t = tapTimes.current;
    if (t.length < 3) return;
    const avg = (t[t.length - 1] - t[0]) / (t.length - 1) / 1000;
    if (avg < 0.6 || avg > 10) return;
    setState((s) => {
      const old = s.repPace[exId];
      return { ...s, repPace: { ...s.repPace, [exId]: Math.round((old ? old * 0.6 + avg * 0.4 : avg) * 10) / 10 } };
    });
  }, []);

  const completeSet = useCallback(
    (actual: number) => {
      if (!isTime && !isAuto && item) learnPace(item.exerciseId);
      setResults((r) => r.map((row, i) => (i === pos.i ? row.map((v, s) => (s === pos.s ? actual : v)) : row)));
      if (isWeighted) setWeights((r) => r.map((row, i) => (i === pos.i ? row.map((v, s) => (s === pos.s ? curWeight : v)) : row)));
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
        setRestHold(null);
        setPhase("rest");
      }
    },
    [items, next, pos, isTime, isAuto, item, learnPace, isWeighted, curWeight],
  );

  // Rest countdown, get-ready countdown, timed holds and auto rep counting.
  useEffect(() => {
    if (pausedAt !== null) return;
    if (phase === "rest") {
      if (restHold !== null) return;
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
    if (phase !== "active" || !usesTimer) return;
    if (readyEndsAt) {
      const left = Math.ceil((readyEndsAt - now) / 1000);
      if (left > 0 && left !== lastTick.current) {
        lastTick.current = left;
        feedback.tick();
      }
      if (now >= readyEndsAt) {
        setReadyEndsAt(0);
        setTimerStart(Date.now());
        lastTick.current = isAuto ? 0 : -1;
        feedback.tap();
      }
      return;
    }
    if (!timerStart || paused !== null) return;
    if (isAuto) {
      if (autoCount !== lastTick.current) {
        if (autoCount > lastTick.current) feedback.tap();
        lastTick.current = autoCount;
        setPulse(true);
        setTimeout(() => setPulse(false), 90);
      }
      if (target > 0 && autoCount >= target) completeSet(autoCount);
      return;
    }
    if (target > 0) {
      const left = Math.ceil((timerStart + target * 1000 - now) / 1000);
      if (left <= 3 && left > 0 && left !== lastTick.current) {
        lastTick.current = left;
        feedback.tick();
      }
      if (left <= 0) completeSet(target);
    }
  }, [now, phase, restEndsAt, restHold, readyEndsAt, timerStart, paused, target, usesTimer, isAuto, autoCount, completeSet, pausedAt]);

  // Keyboard: space/enter counts a rep on desktop.
  useEffect(() => {
    if (phase !== "active" || usesTimer || pausedAt !== null) return;
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

  // ----- Saving progress to finish later -----
  const workoutElapsed = (at: number) => (startedAt ? (at - startedAt - pausedTotal - (pausedAt !== null ? at - pausedAt : 0)) / 1000 : 0);

  const snapshot = (): SavedWorkout => {
    const t = Date.now();
    const restLeft = phase === "rest" ? (pausedAt !== null ? restLeftAtPause : restHold ?? Math.max(0, restEndsAt - t)) : 0;
    return {
      programId: day ? pid : undefined,
      dayId: day ? did : undefined,
      exerciseId: day ? undefined : items[0]?.exerciseId,
      title,
      items,
      results: results.map((row) => row.map((v) => (v === undefined ? null : v))),
      weights: weights.map((row) => row.map((v) => (v === undefined ? null : v))),
      pos,
      phase: phase === "intro" ? "active" : phase,
      count: usesTimer ? 0 : count,
      elapsedMs: Math.max(0, workoutElapsed(t) * 1000),
      restLeftMs: restLeft,
      restTotal,
      savedAt: t,
    };
  };
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const finished = useRef(false);

  const persist = useCallback(() => {
    if (finished.current) return;
    const snap = snapshotRef.current();
    setState((s) => ({ ...s, inProgress: snap }));
  }, []);
  const clearSaved = () => {
    finished.current = true;
    setState((s) => ({ ...s, inProgress: undefined }));
  };

  // Autosave after each set and when the app goes to the background, so nothing is lost if iOS closes it.
  useEffect(() => {
    if (phase !== "intro") persist();
  }, [phase, pos, results, weights, items, persist]);
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && startedAt > 0 && persist();
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [startedAt, persist]);

  function exitDiscard() {
    clearSaved();
    nav.pop();
  }

  function saveForLater() {
    persist();
    finished.current = true;
    nav.pop();
  }

  function addRep() {
    tapTimes.current.push(Date.now());
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

  function startTimer() {
    unlockAudio();
    lastTick.current = -1;
    setReadyEndsAt(Date.now() + 3000);
  }

  function switchMode(mode: "manual" | "auto") {
    if (mode === repMode) return;
    // Carry the current count across so switching mid-set doesn't lose reps.
    if (mode === "manual") setCount(autoCount);
    else setRepOffset(count);
    setReadyEndsAt(0);
    setTimerStart(0);
    setPaused(null);
    lastTick.current = -1;
    setRepMode(mode);
  }

  function pauseWorkout() {
    const t = Date.now();
    setPausedAt(t);
    if (phase === "rest") setRestLeftAtPause(restHold ?? Math.max(0, restEndsAt - t));
    if (readyEndsAt) setReadyEndsAt(0); // restart the get-ready countdown on resume
    if (timerStart && paused === null) {
      setPaused(t - timerStart);
      setTimedPausedByUs(true);
    }
  }

  function resumeWorkout() {
    if (pausedAt === null) return;
    unlockAudio();
    const t = Date.now();
    setPausedTotal((p) => p + (t - pausedAt));
    if (phase === "rest" && restHold === null) setRestEndsAt(t + restLeftAtPause);
    if (timedPausedByUs && paused !== null) {
      setTimerStart(t - paused);
      setPaused(null);
    }
    setTimedPausedByUs(false);
    lastTick.current = isAuto ? autoCount : -1;
    setPausedAt(null);
  }

  function restartSet() {
    if (pausedAt !== null) setPausedTotal((p) => p + (Date.now() - pausedAt));
    resetSet();
    setTimedPausedByUs(false);
    setRestHold(null);
    setPausedAt(null);
    setPhase("active");
  }

  function restartWorkout() {
    resetSet();
    setTimedPausedByUs(false);
    setRestHold(null);
    setResults(items.map((it) => it.sets.map(() => undefined)));
    setWeights(items.map((it) => it.sets.map(() => undefined)));
    setPos({ i: 0, s: 0 });
    setStartedAt(Date.now());
    setPausedTotal(0);
    setPausedAt(null);
    setPhase("active");
  }

  function toggleRestHold() {
    if (restHold === null) setRestHold(Math.max(0, restEndsAt - Date.now()));
    else {
      setRestEndsAt(Date.now() + restHold);
      lastTick.current = -1;
      setRestHold(null);
    }
  }

  function addSet() {
    setItems((its) => its.map((it, i) => (i === pos.i ? { ...it, sets: [...it.sets, it.sets[it.sets.length - 1] ?? 0] } : it)));
    setResults((r) => r.map((row, i) => (i === pos.i ? [...row, undefined] : row)));
    setWeights((r) => r.map((row, i) => (i === pos.i ? [...row, undefined] : row)));
  }

  const totalDone = results.flat().reduce<number>((a, v) => a + (v ?? 0), 0);
  const durationSec = Math.round(workoutElapsed(Date.now()));
  const restLeftSec = (restHold ?? restEndsAt - now) / 1000;

  function save() {
    const log: WorkoutLog = {
      id: uid(),
      date: new Date().toISOString(),
      programId: day ? pid : undefined,
      dayId: day ? did : undefined,
      title,
      durationSec,
      feeling,
      entries: items
        .map((it, i) => ({
          exerciseId: it.exerciseId,
          sets: it.sets.flatMap((t, s) =>
            results[i][s] === undefined ? [] : [{ target: t, actual: results[i][s]!, ...(weights[i]?.[s] ? { weight: weights[i][s], unit: units } : {}) }],
          ),
        }))
        .filter((e) => e.sets.length),
    };
    const pending = getState().goals.filter((g) => !g.achievedAt);
    finished.current = true;
    setState((s) => {
      const logs = [log, ...s.logs];
      const goals = s.goals.map((g) => (!g.achievedAt && goalProgress(g, logs) >= g.target ? { ...g, achievedAt: Date.now() } : g));
      let active = s.active;
      if (day && pid) {
        if (!active || active.programId !== pid) active = { programId: pid, completedDayIds: [], startedAt: Date.now() };
        if (!active.completedDayIds.includes(day.id)) active = { ...active, completedDayIds: [...active.completedDayIds, day.id] };
      }
      return { ...s, logs, goals, active, inProgress: undefined };
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

  const unfinishedOther = phase === "intro" && state.inProgress && !resume;

  return (
    <div className="overlay">
      <div className={`overlay-inner ${phase === "rest" ? "rest-screen" : ""}`}>
        <div className="player">
          <div className="row between">
            <button className="icon-btn" onClick={() => (phase === "intro" ? nav.pop() : phase === "summary" ? exitDiscard() : setConfirmExit(true))} aria-label="Close">
              <X size={20} />
            </button>
            {(phase === "active" || phase === "rest") && (
              <button className="icon-btn" onClick={pauseWorkout} aria-label="Pause workout">
                <Pause size={18} />
              </button>
            )}
            <div className="col grow" style={{ gap: 0, alignItems: "center" }}>
              <span className="eyebrow ellipsis" style={{ maxWidth: "100%" }}>
                {program?.name ?? "Quick workout"}
              </span>
              {startedAt > 0 && phase !== "summary" && <span className="num small muted">{fmtTime(workoutElapsed(now))}</span>}
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

          <WorkoutMusic visible={showMusic} autoStart={startedAt > 0 && pausedAt === null} />

          {phase === "intro" && (
            <>
              {unfinishedOther && (
                <div className="banner">
                  <span>
                    You have an unfinished workout ({state.inProgress!.title}). Starting this one replaces it.{" "}
                    <button
                      style={{ textDecoration: "underline", fontWeight: 700, color: "inherit" }}
                      onClick={() => nav.replace({ name: "workout", resume: true })}
                    >
                      Resume that instead
                    </button>
                  </span>
                </div>
              )}
              <Intro title={day?.title ?? title} focus={day?.focus} items={items} onStart={start} />
            </>
          )}

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
                        {r !== undefined && <small>{weights[pos.i]?.[s] ? `${weights[pos.i][s]}${units}` : `/${setLabel(t, exercise.type)}`}</small>}
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
                  left={restLeftSec}
                  total={restTotal}
                  held={restHold !== null}
                  upNext={exercise}
                  upNextTarget={target}
                  newExercise={pos.s === 0}
                  onAdd={(n) => {
                    if (restHold !== null) setRestHold((h) => Math.max(0, (h ?? 0) + n * 1000));
                    else setRestEndsAt((e) => e + n * 1000);
                    setRestTotal((t) => Math.max(1, t + n));
                  }}
                  onToggleHold={toggleRestHold}
                  onSkip={() => {
                    setRestHold(null);
                    setPhase("active");
                  }}
                />
              ) : isTime ? (
                <TimedSet
                  target={target}
                  elapsed={elapsedTimed}
                  readyLeft={readyEndsAt ? Math.ceil((readyEndsAt - now) / 1000) : 0}
                  running={timerStart > 0}
                  paused={paused !== null}
                  onStart={startTimer}
                  onPause={() => setPaused(now - timerStart)}
                  onResume={() => {
                    setTimerStart(Date.now() - (paused ?? 0));
                    setPaused(null);
                  }}
                  onStop={() => completeSet(Math.round(elapsedTimed))}
                />
              ) : (
                <>
                  {isWeighted && (
                    <div className="weight-row">
                      <button className="icon-btn" onClick={() => setCurWeight((w) => Math.max(0, Math.round((w - weightStep) * 10) / 10))} aria-label="Less weight">
                        <Minus size={18} />
                      </button>
                      <input
                        className="input num"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={weightStep}
                        value={curWeight || ""}
                        placeholder="0"
                        onChange={(e) => setCurWeight(Math.max(0, Number(e.target.value) || 0))}
                        aria-label={`Weight in ${units}`}
                      />
                      <span className="muted" style={{ fontWeight: 700, minWidth: 22 }}>
                        {units}
                      </span>
                      <button className="icon-btn" onClick={() => setCurWeight((w) => Math.round((w + weightStep) * 10) / 10)} aria-label="More weight">
                        <Plus size={18} />
                      </button>
                    </div>
                  )}
                  <div className="seg" style={{ alignSelf: "center", width: 220 }} role="tablist" aria-label="Rep counting">
                    <button className={repMode === "manual" ? "on" : ""} onClick={() => switchMode("manual")} role="tab" aria-selected={repMode === "manual"}>
                      <Hand size={13} style={{ verticalAlign: -2 }} /> Tap
                    </button>
                    <button className={repMode === "auto" ? "on" : ""} onClick={() => switchMode("auto")} role="tab" aria-selected={repMode === "auto"}>
                      <Timer size={13} style={{ verticalAlign: -2 }} /> Auto
                    </button>
                  </div>
                  <div
                    className="tap-zone"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      if (!isAuto) addRep();
                      else if (!timerStart && !readyEndsAt) startTimer();
                      else if (timerStart) paused === null ? setPaused(now - timerStart) : (setTimerStart(Date.now() - paused), setPaused(null));
                    }}
                  >
                    <div className={`tap-circle ${pulse ? "pulse" : ""} ${isAuto && paused !== null ? "dim" : ""}`}>
                      {isAuto && readyEndsAt ? (
                        <>
                          <span className="of">Get ready</span>
                          <span className="count num">{Math.max(1, Math.ceil((readyEndsAt - now) / 1000))}</span>
                        </>
                      ) : (
                        <>
                          <span className="count num">{shownCount}</span>
                          <span className="of">{target > 0 ? `of ${target}` : "max effort"}</span>
                        </>
                      )}
                      {!isAuto && count === 0 && <span className="hint">Tap to count</span>}
                      {isAuto && !timerStart && !readyEndsAt && <span className="hint">Tap to start</span>}
                      {isAuto && timerStart > 0 && <span className="hint">{paused !== null ? "Paused · tap to go" : "Tap to pause"}</span>}
                    </div>
                  </div>
                  {isAuto ? (
                    <div className="row" style={{ justifyContent: "center", gap: 8 }}>
                      <span className="small muted">1 rep every</span>
                      <button className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => setPaceOverride(Math.max(0.5, Math.round((pace - 0.5) * 10) / 10))} aria-label="Faster">
                        <Minus size={14} />
                      </button>
                      <span className="num" style={{ fontWeight: 800, minWidth: 44, textAlign: "center" }}>
                        {pace.toFixed(1)}s
                      </span>
                      <button className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => setPaceOverride(Math.round((pace + 0.5) * 10) / 10)} aria-label="Slower">
                        <Plus size={14} />
                      </button>
                      <span className="faint" style={{ fontSize: 11 }}>
                        {paceOverride !== null ? "custom" : state.settings.autoPace === "average" ? (state.repPace[item.exerciseId] ? "your avg" : "default") : "fixed"}
                      </span>
                    </div>
                  ) : (
                    target > 0 && (
                      <div className="bar">
                        <div style={{ width: `${Math.min(100, (count / target) * 100)}%` }} />
                      </div>
                    )
                  )}
                  <div className="row">
                    <button
                      className="icon-btn"
                      style={{ width: 58, height: 58 }}
                      onClick={() => (isAuto ? setRepOffset((o) => (autoCount > 0 ? o - 1 : o)) : setCount((c) => Math.max(0, c - 1)))}
                      aria-label="Minus one"
                    >
                      <Minus size={22} />
                    </button>
                    <button className="btn primary lg grow" onClick={() => completeSet(shownCount)}>
                      <Check size={20} /> {shownCount >= target || target === 0 ? (isAuto && timerStart ? "Stop & log" : "Set done") : `Finish at ${shownCount}`}
                    </button>
                    {isAuto ? (
                      <button className="icon-btn" style={{ width: 58, height: 58 }} onClick={() => setRepOffset((o) => o + 1)} aria-label="Plus one">
                        <Plus size={22} />
                      </button>
                    ) : (
                      target > 0 && (
                        <button className="icon-btn" style={{ width: 58, height: 58, fontWeight: 800 }} onClick={() => setCount(target)} aria-label="Fill target">
                          {target}
                        </button>
                      )
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
                          {it.sets
                            .map((_, s) =>
                              results[i][s] === undefined ? "–" : `${results[i][s]}${ex?.type === "time" ? "s" : ""}${weights[i]?.[s] ? ` × ${weights[i][s]}${units}` : ""}`,
                            )
                            .join(" · ")}
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
              <button className="btn primary lg block" onClick={save} disabled={!results.flat().some((v) => v !== undefined)}>
                Save workout
              </button>
              <button className="btn ghost block danger" onClick={exitDiscard}>
                Discard
              </button>
            </div>
          )}
        </div>
      </div>

      <Sheet open={showGuide} onClose={() => setShowGuide(false)} title={exercise?.name}>
        {exercise && <ExerciseGuide exercise={exercise} compact />}
      </Sheet>
      {pausedAt !== null && (
        <div className="pause-screen" role="dialog" aria-modal="true" aria-label="Workout paused">
          <div className="col" style={{ alignItems: "center", gap: 6, textAlign: "center" }}>
            <span className="eyebrow">{saved && pausedTotal === 0 ? "Welcome back · workout paused" : "Workout paused"}</span>
            <span className="big-time num">{fmtTime(workoutElapsed(now))}</span>
            <span className="small muted">
              {phase === "summary" ? "All sets done" : `${exercise?.name} · set ${pos.s + 1} of ${item?.sets.length}`}
              {phase === "rest" ? ` · ${fmtTime(restLeftAtPause / 1000)} rest left` : ""}
            </span>
          </div>
          <div className="col" style={{ gap: 10, width: "100%" }}>
            <button className="btn primary lg block" onClick={resumeWorkout}>
              <Play size={20} fill="#fff" /> Resume
            </button>
            <button className="btn block" onClick={saveForLater}>
              <Save size={16} /> Save & finish later
            </button>
            {phase !== "summary" && (
              <button className="btn block" onClick={restartSet}>
                <RotateCcw size={16} /> Restart this set
              </button>
            )}
            <button className="btn block" onClick={restartWorkout}>
              <RotateCcw size={16} /> Restart workout from the beginning
            </button>
            <button className="btn ghost block danger" onClick={() => setConfirmExit(true)}>
              <Square size={14} /> End workout
            </button>
          </div>
        </div>
      )}
      <Sheet open={confirmExit} onClose={() => setConfirmExit(false)} title="End workout?">
        <div className="col" style={{ gap: 10 }}>
          <p className="muted">Save the sets you've done, keep this workout to finish later, or discard it.</p>
          <button
            className="btn primary block"
            onClick={() => {
              setConfirmExit(false);
              resumeWorkout();
              setPhase("summary");
            }}
          >
            Finish & review
          </button>
          <button
            className="btn block"
            onClick={() => {
              setConfirmExit(false);
              saveForLater();
            }}
          >
            <Save size={16} /> Save & finish later
          </button>
          <button className="btn block danger" onClick={exitDiscard}>
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
  const unique = useMemo(() => exercises.filter((e, i, arr): e is Exercise => !!e && arr.findIndex((x) => x?.id === e.id) === i), [exercises]);
  const [preview, setPreview] = useState(0);
  const shown = unique[preview] ?? unique[0];
  const missing = [...new Set(unique.filter((e) => !canDo(e)).flatMap((e) => e.equipmentIds ?? []))].filter((id) => !(getState().profile.equipmentList ?? []).includes(id));
  return (
    <div className="col" style={{ gap: 18, flex: 1 }}>
      <div className="col" style={{ gap: 6, paddingTop: 10 }}>
        <h1 style={{ fontSize: 30, fontWeight: 900 }}>{title}</h1>
        {focus && <p className="muted">{focus}</p>}
      </div>
      {shown && (
        <div className="card col" style={{ gap: 12 }}>
          {unique.length > 1 && (
            <div className="set-chips" role="tablist" aria-label="Preview exercise">
              {unique.map((e, i) => (
                <button key={e.id} className={`chip ${i === preview ? "accent" : ""}`} style={{ padding: "8px 12px", fontSize: 13 }} onClick={() => setPreview(i)} role="tab" aria-selected={i === preview}>
                  {e.emoji} {e.name}
                </button>
              ))}
            </div>
          )}
          <ExerciseVisual key={shown.id} exercise={shown} />
        </div>
      )}
      {missing.length > 0 && <div className="banner">This workout uses equipment you haven't ticked: {missing.map(equipmentName).join(", ")}.</div>}
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
  held,
  upNext,
  upNextTarget,
  newExercise,
  onAdd,
  onToggleHold,
  onSkip,
}: {
  left: number;
  total: number;
  held: boolean;
  upNext: Exercise;
  upNextTarget: number;
  newExercise: boolean;
  onAdd: (n: number) => void;
  onToggleHold: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="col" style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 20 }}>
      <span className="eyebrow" style={{ color: held ? "var(--warn)" : "var(--blue)" }}>
        {held ? "Rest paused" : "Rest & recover"}
      </span>
      <ProgressRing value={total ? left / total : 0} size={Math.min(280, window.innerWidth * 0.68)} stroke={14} color={held ? "var(--warn)" : "var(--blue)"}>
        <span className="big-time num" style={held ? { opacity: 0.75 } : undefined}>
          {fmtTime(Math.ceil(left))}
        </span>
        <span className="small muted">of {fmtTime(total)}</span>
      </ProgressRing>
      <div className="row" style={{ flexWrap: "wrap", justifyContent: "center" }}>
        <button className="btn" onClick={() => onAdd(-15)} disabled={left < 16}>
          −15s
        </button>
        <button className="btn" onClick={onToggleHold} aria-label={held ? "Resume rest timer" : "Pause rest timer"} style={{ minWidth: 58 }}>
          {held ? <Play size={18} /> : <Pause size={18} />}
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
      {newExercise && (
        <div className="card flat" style={{ width: "100%" }}>
          <ExerciseVisual exercise={upNext} compact />
        </div>
      )}
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
