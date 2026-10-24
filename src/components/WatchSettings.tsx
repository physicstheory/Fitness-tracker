import { useState } from "react";
import { Watch } from "lucide-react";
import { setState, useAppState } from "../store";
import { testWatch } from "../lib/watch";
import { apiBase } from "../lib/api";
import { isNative } from "../lib/native";

/** Pair with the RepRise Garmin watch app by entering the code it shows. */
export function WatchSettings() {
  const state = useAppState();
  const code = state.settings.watchCode ?? "";
  const [status, setStatus] = useState("");
  const [testing, setTesting] = useState(false);
  const needsServer = isNative && !apiBase();

  async function test() {
    setTesting(true);
    const r = await testWatch(code);
    setTesting(false);
    if (!r.ok) return setStatus(`Can't reach the RepRise server. ${needsServer ? "Add your server address above first." : ""}`);
    if (!r.watchSeen) return setStatus("Server OK. Open RepRise on your watch (with Garmin Connect running on this phone) and check the code matches.");
    const secs = Math.round((Date.now() - r.watchSeen) / 1000);
    setStatus(secs < 30 ? "✅ Watch connected!" : `Watch last checked in ${secs < 3600 ? `${Math.round(secs / 60)} min` : `${Math.round(secs / 3600)} h`} ago. Open RepRise on the watch.`);
  }

  return (
    <div className="card col" style={{ gap: 10 }}>
      <div className="row">
        <span className="emoji-badge" style={{ background: "#0a7cba" }}>
          <Watch color="#fff" size={20} />
        </span>
        <div className="grow">
          <div style={{ fontWeight: 750 }}>Garmin watch</div>
          <div className="small muted">Count reps on your wrist; they appear here live.</div>
        </div>
      </div>
      <label className="field">
        Code shown on the watch
        <input
          className="input num"
          inputMode="numeric"
          maxLength={6}
          placeholder="e.g. 4821"
          value={code}
          onChange={(e) => setState((s) => ({ ...s, settings: { ...s.settings, watchCode: e.target.value.replace(/\D/g, "").slice(0, 6) } }))}
        />
      </label>
      {needsServer && <div className="banner">The watch link uses your RepRise server. Add its address under "AI server" above.</div>}
      <button className="btn block" disabled={code.length < 4 || testing} onClick={test}>
        {testing ? "Checking…" : "Test connection"}
      </button>
      {status && <p className="small">{status}</p>}
      <details className="small muted">
        <summary style={{ fontWeight: 700, cursor: "pointer" }}>How to set up the watch app</summary>
        <ol className="clean" style={{ marginTop: 8 }}>
          <li>Install the RepRise watch app (see "Garmin watch app" in the README; it's built once from the garmin/ folder and copied to the watch over USB).</li>
          <li>Keep the Garmin Connect app running on this phone; the watch goes online through it.</li>
          <li>Open RepRise on the watch, note the 4-digit code and enter it above.</li>
          <li>Start a workout here: the watch shows each exercise, counts your reps from your wrist movement, and sends them back live. Press START on the watch to finish a set.</li>
        </ol>
      </details>
    </div>
  );
}
