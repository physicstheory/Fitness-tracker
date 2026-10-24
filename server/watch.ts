import type express from "express";

// Relay between the RepRise phone app and the Garmin watch app.
// The watch reaches the internet through the Garmin Connect app on the phone, so both
// sides talk to this server, matched by the short code shown on the watch.

interface PlanItem {
  name: string;
  type: "reps" | "time";
  targets: number[];
  restSec: number;
}

interface WatchEvent {
  seq: number;
  type: "reps" | "set";
  i: number;
  s: number;
  reps: number;
  at: number;
}

interface Session {
  title: string;
  items: PlanItem[];
  pos: { i: number; s: number };
  phase: string;
  restLeft: number;
  events: WatchEvent[];
  seq: number;
  touched: number;
  watchSeen: number;
}

const sessions = new Map<string, Session>();
const TTL = 12 * 3600 * 1000;

const validCode = (c: unknown): c is string => typeof c === "string" && /^[0-9]{4,6}$/.test(c);

function session(code: string): Session {
  let s = sessions.get(code);
  if (!s) {
    s = { title: "", items: [], pos: { i: 0, s: 0 }, phase: "idle", restLeft: 0, events: [], seq: 0, touched: Date.now(), watchSeen: 0 };
    sessions.set(code, s);
  }
  s.touched = Date.now();
  return s;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, s] of sessions) if (now - s.touched > TTL) sessions.delete(k);
}, 30 * 60 * 1000).unref();

export function mountWatchRoutes(app: express.Express) {
  // Phone → server: the current workout and where the user is in it.
  app.post("/api/watch/plan", (req, res) => {
    const { code, title, items, pos, phase, restLeft } = req.body ?? {};
    if (!validCode(code) || !Array.isArray(items)) {
      res.status(400).json({ error: "code and items are required" });
      return;
    }
    const s = session(code);
    s.title = String(title ?? "").slice(0, 60);
    s.items = items.slice(0, 30).map((it: PlanItem) => ({
      name: String(it.name ?? "Exercise").slice(0, 40),
      type: it.type === "time" ? "time" : "reps",
      targets: Array.isArray(it.targets) ? it.targets.slice(0, 20).map((n) => Math.max(0, Math.round(Number(n) || 0))) : [],
      restSec: Math.max(0, Math.round(Number(it.restSec) || 0)),
    }));
    s.pos = { i: Math.max(0, Number(pos?.i) || 0), s: Math.max(0, Number(pos?.s) || 0) };
    s.phase = String(phase ?? "active");
    s.restLeft = Math.max(0, Math.round(Number(restLeft) || 0));
    res.json({ ok: true, watchSeen: s.watchSeen });
  });

  // Watch → server: what to show now. Flat fields keep the watch code simple.
  app.get("/api/watch/plan", (req, res) => {
    const code = req.query.code;
    if (!validCode(code)) {
      res.status(400).json({ ok: false, error: "bad code" });
      return;
    }
    const s = session(code);
    s.watchSeen = Date.now();
    const item = s.items[s.pos.i];
    const next = s.items[s.pos.i + (item && s.pos.s + 1 >= item.targets.length ? 1 : 0)];
    res.json({
      ok: true,
      active: Boolean(item) && s.phase !== "idle" && s.phase !== "summary",
      title: s.title,
      name: item?.name ?? "",
      type: item?.type ?? "reps",
      i: s.pos.i,
      s: s.pos.s,
      set: s.pos.s + 1,
      sets: item?.targets.length ?? 0,
      target: item?.targets[s.pos.s] ?? 0,
      rest: item?.restSec ?? 60,
      phase: s.phase,
      restLeft: s.restLeft,
      exercise: s.pos.i + 1,
      exercises: s.items.length,
      next: next?.name ?? "",
    });
  });

  // Watch → server: live rep counts and finished sets.
  app.post("/api/watch/event", (req, res) => {
    const { code, type, i, s: setIndex, reps } = req.body ?? {};
    if (!validCode(code) || (type !== "reps" && type !== "set")) {
      res.status(400).json({ ok: false, error: "bad event" });
      return;
    }
    const s = session(code);
    s.watchSeen = Date.now();
    const ev: WatchEvent = { seq: ++s.seq, type, i: Number(i) || 0, s: Number(setIndex) || 0, reps: Math.max(0, Math.round(Number(reps) || 0)), at: Date.now() };
    s.events.push(ev);
    if (s.events.length > 200) s.events.splice(0, s.events.length - 200);
    res.json({ ok: true, seq: ev.seq });
  });

  // Phone → server: events since `after` (use after=-1 to just get the latest sequence number).
  app.get("/api/watch/events", (req, res) => {
    const code = req.query.code;
    if (!validCode(code)) {
      res.status(400).json({ error: "bad code" });
      return;
    }
    const s = session(code);
    const after = Number(req.query.after ?? -1);
    res.json({
      last: s.seq,
      watchSeen: s.watchSeen,
      events: after < 0 ? [] : s.events.filter((e) => e.seq > after),
    });
  });
}
