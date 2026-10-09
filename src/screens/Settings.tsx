import { useRef, useState } from "react";
import { ChevronRight, Download, Dumbbell, Upload } from "lucide-react";
import { Overlay, Sheet, Switch } from "../components/ui";
import { getState, replaceState, resetState, setState, useAppState } from "../store";
import { useNav } from "../nav";
import type { AppState, Level, Profile, Settings as SettingsT } from "../types";

export function Settings() {
  const state = useAppState();
  const nav = useNav();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [msg, setMsg] = useState("");

  const setProfile = (p: Partial<Profile>) => setState((s) => ({ ...s, profile: { ...s.profile, ...p } }));
  const setSettings = (p: Partial<SettingsT>) => setState((s) => ({ ...s, settings: { ...s.settings, ...p } }));

  function exportData() {
    const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `reprise-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importData(file: File) {
    try {
      const data = JSON.parse(await file.text()) as AppState;
      if (data.version !== 1 || !Array.isArray(data.logs)) throw new Error();
      replaceState(data);
      setMsg("Backup restored.");
    } catch {
      setMsg("That file isn't a valid RepRise backup.");
    }
  }

  return (
    <Overlay title="Profile & settings">
      <div className="card col" style={{ gap: 14 }}>
        <span className="eyebrow">Your profile · used by the AI coach</span>
        <label className="field">
          Name
          <input className="input" value={state.profile.name} onChange={(e) => setProfile({ name: e.target.value })} placeholder="What should we call you?" />
        </label>
        <div className="col" style={{ gap: 6 }}>
          <span className="small muted" style={{ fontWeight: 650 }}>
            Fitness level
          </span>
          <div className="seg">
            {(["beginner", "intermediate", "advanced"] as Level[]).map((l) => (
              <button key={l} className={state.profile.level === l ? "on" : ""} onClick={() => setProfile({ level: l })} style={{ textTransform: "capitalize" }}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          Age (optional)
          <input
            className="input"
            type="number"
            inputMode="numeric"
            value={state.profile.age ?? ""}
            onChange={(e) => setProfile({ age: e.target.value ? Number(e.target.value) : undefined })}
          />
        </label>
        <label className="field">
          Injuries or limitations
          <textarea className="input" value={state.profile.limitations} onChange={(e) => setProfile({ limitations: e.target.value })} placeholder="e.g. sore left shoulder, bad knees" />
        </label>
        <label className="field">
          Equipment available
          <input className="input" value={state.profile.equipment} onChange={(e) => setProfile({ equipment: e.target.value })} />
        </label>
      </div>

      <div className="card col" style={{ gap: 0 }}>
        <span className="eyebrow" style={{ marginBottom: 4 }}>
          Workout
        </span>
        <label className="field" style={{ padding: "8px 0 12px" }}>
          Daily rep target
          <input className="input num" type="number" inputMode="numeric" min={1} value={state.settings.dailyRepTarget} onChange={(e) => setSettings({ dailyRepTarget: Math.max(1, Number(e.target.value)) })} />
        </label>
        <Switch label="Sounds" hint="Beeps for reps, countdowns and timers" on={state.settings.sound} onChange={(v) => setSettings({ sound: v })} />
        <Switch label="Countdown beeps" hint="Beep for the last 3 seconds of rest" on={state.settings.countdownBeeps} onChange={(v) => setSettings({ countdownBeeps: v })} />
        <Switch label="Vibration" hint="On supported phones" on={state.settings.vibrate} onChange={(v) => setSettings({ vibrate: v })} />
        <Switch label="Auto-start rest timer" hint="Start the cooldown as soon as a set is done" on={state.settings.autoStartRest} onChange={(v) => setSettings({ autoStartRest: v })} />
      </div>

      <button className="card tap row" onClick={() => nav.push({ name: "library" })}>
        <span className="emoji-badge">
          <Dumbbell size={20} />
        </span>
        <span className="grow" style={{ fontWeight: 700 }}>
          Exercise library
        </span>
        <ChevronRight className="faint" />
      </button>

      <div className="card col" style={{ gap: 10 }}>
        <span className="eyebrow">Your data</span>
        <p className="small muted">Everything is stored on this device. Export a backup to move it to another phone or browser.</p>
        <div className="grid-2">
          <button className="btn" onClick={exportData}>
            <Download size={16} /> Export
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> Restore
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
        {msg && <p className="small muted">{msg}</p>}
        <button className="btn ghost danger" onClick={() => setConfirmReset(true)}>
          Reset all data
        </button>
      </div>

      <Sheet open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset everything?">
        <div className="col" style={{ gap: 10 }}>
          <p className="muted">This deletes all workouts, goals, programs and settings on this device. It can't be undone.</p>
          <button
            className="btn block danger"
            onClick={() => {
              resetState();
              setConfirmReset(false);
            }}
          >
            Delete everything
          </button>
          <button className="btn ghost block" onClick={() => setConfirmReset(false)}>
            Cancel
          </button>
        </div>
      </Sheet>
    </Overlay>
  );
}
