import { ChevronRight, Flame, Play, Settings as Cog, Sparkles, Target, Upload, Zap } from "lucide-react";
import { ProgressRing } from "../components/ui";
import { addDays, dailyTotals, dayKey, goalProgress, streak } from "../lib/stats";
import { findExercise, findProgram, useAppState } from "../store";
import { useNav } from "../nav";

const QUICK = ["push-up", "squat", "sit-up", "plank", "burpee", "pull-up"];

export function Today() {
  const state = useAppState();
  const nav = useNav();
  const { current, best } = streak(state.logs);
  const today = dailyTotals(state.logs, 1)[0].value;
  const target = state.settings.dailyRepTarget;
  const active = state.active;
  const program = findProgram(active?.programId, state);
  const nextDay = program?.days.find((d) => !active!.completedDayIds.includes(d.id));
  const doneDays = new Set(state.logs.map((l) => dayKey(l.date)));
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // Monday-first week strip.
  const now = new Date();
  const monday = addDays(now, -((now.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const quick = QUICK.map((id) => findExercise(id, state)).filter(Boolean).concat(state.customExercises.slice(0, 2));

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="col" style={{ gap: 2 }}>
          <span className="eyebrow">{now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</span>
          <h1>
            {greet}
            {state.profile.name ? `, ${state.profile.name}` : ""}
          </h1>
        </div>
        <button className="icon-btn" onClick={() => nav.push({ name: "settings" })} aria-label="Settings">
          <Cog size={20} />
        </button>
      </div>

      <div className="card row" style={{ gap: 18 }}>
        <ProgressRing value={target ? today / target : 0} size={118} stroke={12}>
          <span className="num" style={{ fontSize: 28, fontWeight: 900, lineHeight: 1 }}>
            {today}
          </span>
          <span className="small muted">/ {target}</span>
        </ProgressRing>
        <div className="col grow" style={{ gap: 10 }}>
          <div>
            <span className="eyebrow">Today's reps</span>
            <p style={{ fontWeight: 700 }}>
              {today >= target ? "Daily target smashed! 🎉" : `${target - today} to go today`}
            </p>
          </div>
          <div className="row" style={{ gap: 14 }}>
            <div className="row" style={{ gap: 6 }}>
              <Flame size={20} color="var(--accent)" fill="var(--accent)" />
              <div className="col" style={{ gap: 0 }}>
                <span className="num" style={{ fontWeight: 800, fontSize: 18, lineHeight: 1.1 }}>
                  {current}
                </span>
                <span className="faint" style={{ fontSize: 11, fontWeight: 600 }}>
                  day streak
                </span>
              </div>
            </div>
            <div className="col" style={{ gap: 0 }}>
              <span className="num" style={{ fontWeight: 800, fontSize: 18, lineHeight: 1.1 }}>
                {best}
              </span>
              <span className="faint" style={{ fontSize: 11, fontWeight: 600 }}>
                best streak
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="week-strip">
        {week.map((d) => {
          const k = dayKey(d);
          return (
            <div key={k} className="d">
              {d.toLocaleDateString(undefined, { weekday: "narrow" })}
              <div className={`dot ${doneDays.has(k) ? "on" : ""} ${k === dayKey(now) ? "today" : ""}`}>{d.getDate()}</div>
            </div>
          );
        })}
      </div>

      {program && nextDay ? (
        <button className="card hero tap" onClick={() => nav.push({ name: "workout", programId: program.id, dayId: nextDay.id })}>
          <div className="col" style={{ gap: 10, position: "relative", zIndex: 1 }}>
            <span className="eyebrow" style={{ color: "rgba(255,255,255,.85)" }}>
              Up next · {program.name}
            </span>
            <h2 style={{ fontSize: 26, fontWeight: 900 }}>{nextDay.title}</h2>
            <p className="muted">{nextDay.focus}</p>
            <div className="row between" style={{ marginTop: 6 }}>
              <div className="col grow" style={{ gap: 6, marginRight: 16 }}>
                <div className="bar" style={{ background: "rgba(255,255,255,.25)" }}>
                  <div style={{ width: `${(active!.completedDayIds.length / program.days.length) * 100}%`, background: "#fff" }} />
                </div>
                <span className="small muted">
                  {active!.completedDayIds.length} of {program.days.length} sessions done
                </span>
              </div>
              <span className="btn white">
                <Play size={18} fill="#111" /> Start
              </span>
            </div>
          </div>
        </button>
      ) : program ? (
        <div className="card hero">
          <h2 style={{ fontSize: 22 }}>🏆 {program.name} complete!</h2>
          <p className="muted">Pick a new challenge or set a fresh goal.</p>
        </div>
      ) : (
        <button className="card tap row" onClick={() => nav.setTab("programs")}>
          <div className="emoji-badge" style={{ background: "var(--grad)" }}>
            <Zap color="#fff" />
          </div>
          <div className="grow">
            <div style={{ fontWeight: 750 }}>Start a challenge</div>
            <div className="small muted">Try the 100 Push-Up Challenge or import your own program</div>
          </div>
          <ChevronRight className="faint" />
        </button>
      )}

      <div className="section-title">
        <h2>Quick log</h2>
        <button className="small muted" style={{ fontWeight: 650 }} onClick={() => nav.push({ name: "library" })}>
          All exercises
        </button>
      </div>
      <div className="grid-3">
        {quick.slice(0, 6).map((ex) => (
          <button key={ex!.id} className="card tap col" style={{ alignItems: "center", gap: 6, padding: 14 }} onClick={() => nav.push({ name: "workout", exerciseId: ex!.id })}>
            <span style={{ fontSize: 28 }}>{ex!.emoji}</span>
            <span className="small ellipsis" style={{ fontWeight: 700, maxWidth: "100%" }}>
              {ex!.name}
            </span>
          </button>
        ))}
      </div>

      {state.goals.filter((g) => !g.achievedAt).length > 0 && (
        <>
          <div className="section-title">
            <h2>Goals</h2>
            <button className="small muted" style={{ fontWeight: 650 }} onClick={() => nav.setTab("goals")}>
              See all
            </button>
          </div>
          {state.goals
            .filter((g) => !g.achievedAt)
            .slice(0, 2)
            .map((g) => {
              const ex = findExercise(g.exerciseId, state);
              const v = goalProgress(g, state.logs);
              return (
                <button key={g.id} className="card tap col" onClick={() => nav.setTab("goals")}>
                  <div className="row between">
                    <div className="row">
                      <Target size={18} color="var(--accent)" />
                      <span style={{ fontWeight: 700 }}>
                        {g.target} {ex?.name}
                      </span>
                    </div>
                    <span className="num small muted">
                      {v}/{g.target}
                    </span>
                  </div>
                  <div className="bar">
                    <div style={{ width: `${Math.min(100, (v / g.target) * 100)}%` }} />
                  </div>
                </button>
              );
            })}
        </>
      )}

      <div className="grid-2">
        <button className="card tap col" style={{ gap: 8 }} onClick={() => nav.push({ name: "import" })}>
          <Upload size={22} color="var(--violet)" />
          <span style={{ fontWeight: 750 }}>Import a program</span>
          <span className="small muted">Upload a PDF, doc or photo and AI builds it</span>
        </button>
        <button className="card tap col" style={{ gap: 8 }} onClick={() => nav.setTab("coach")}>
          <Sparkles size={22} color="var(--blue)" />
          <span style={{ fontWeight: 750 }}>Ask your coach</span>
          <span className="small muted">Form tips, plans and motivation</span>
        </button>
      </div>
    </div>
  );
}
