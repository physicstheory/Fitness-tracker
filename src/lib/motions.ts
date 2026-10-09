// Keyframed side-view movements for the form animations. The figure faces right.
// Scene is 240×210 with the floor at y = 202; ankles rest at y = 198.
// Each pose fixes the hip, shoulder, hand and foot; elbows and knees are solved with two-bone IK.

export type P = [number, number];

export interface Pose {
  hip: P;
  sh: P;
  hand: P;
  foot: P;
  /** Far-side limbs, when they differ (e.g. a lunge's back leg). */
  hand2?: P;
  foot2?: P;
}

export type Prop =
  | { type: "bench"; x: number; y: number; w: number }
  | { type: "bar"; x1: number; x2: number; y: number }
  | { type: "wall"; x: number }
  | { type: "seat"; x: number; y: number; w: number }
  | { type: "dumbbell" | "barbell" | "kettlebell"; at: "hand" | "hip" }
  | { type: "cable"; from: P }
  | { type: "platform" };

export interface Motion {
  id: string;
  label: string;
  /** Seconds per repetition. */
  duration: number;
  keys: { t: number; pose: Pose }[];
  /** +1 bends the joint toward the figure's back, -1 toward its front. */
  elbow: 1 | -1;
  knee: 1 | -1;
  knee2?: 1 | -1;
  props?: Prop[];
  /** Static holds just "breathe" between their keyframes. */
  hold?: boolean;
  cue: string;
}

const STAND: Pose = { hip: [120, 118], sh: [120, 66], hand: [122, 124], foot: [122, 198] };

const loop = (a: Pose, b: Pose, hold = 0.06): Motion["keys"] => [
  { t: 0, pose: a },
  { t: 0.5 - hold, pose: b },
  { t: 0.5 + hold, pose: b },
  { t: 1, pose: a },
];

const PUSH_TOP: Pose = { hip: [136, 164], sh: [184, 144], hand: [180, 198], foot: [59, 197] };
const CROUCH: Pose = { hip: [106, 166], sh: [142, 142], hand: [152, 198], foot: [124, 198] };

export const MOTIONS: Record<string, Motion> = {
  pushup: {
    id: "pushup",
    label: "Push-up",
    duration: 2.4,
    elbow: 1,
    knee: 1,
    keys: loop(PUSH_TOP, { hip: [142, 185], sh: [196, 178], hand: [180, 198], foot: [59, 197] }),
    cue: "Body stays in one straight line from head to heels.",
  },
  squat: {
    id: "squat",
    label: "Squat",
    duration: 2.6,
    elbow: -1,
    knee: -1,
    keys: loop({ hip: [120, 118], sh: [120, 66], hand: [176, 70], foot: [124, 198] }, { hip: [92, 158], sh: [122, 116], hand: [178, 114], foot: [124, 198] }),
    cue: "Hips back and down, chest up, knees track over toes.",
  },
  goblet: {
    id: "goblet",
    label: "Goblet squat",
    duration: 2.8,
    elbow: 1,
    knee: -1,
    keys: loop({ hip: [120, 118], sh: [120, 66], hand: [136, 92], foot: [124, 198] }, { hip: [92, 158], sh: [122, 116], hand: [146, 136], foot: [124, 198] }),
    props: [{ type: "dumbbell", at: "hand" }],
    cue: "Hold the weight at your chest and sit between your heels.",
  },
  lunge: {
    id: "lunge",
    label: "Lunge",
    duration: 2.6,
    elbow: 1,
    knee: -1,
    knee2: -1,
    keys: loop(
      { hip: [120, 122], sh: [120, 70], hand: [128, 124], foot: [154, 198], foot2: [84, 198] },
      { hip: [120, 152], sh: [121, 100], hand: [128, 152], foot: [154, 198], foot2: [84, 198] },
    ),
    cue: "Drop the back knee straight down; front knee over the ankle.",
  },
  situp: {
    id: "situp",
    label: "Sit-up",
    duration: 2.4,
    elbow: 1,
    knee: -1,
    keys: loop({ hip: [120, 190], sh: [68, 190], hand: [84, 180], foot: [166, 198] }, { hip: [120, 190], sh: [146, 146], hand: [150, 160], foot: [166, 198] }),
    cue: "Curl up one vertebra at a time; don't yank your neck.",
  },
  plank: {
    id: "plank",
    label: "Plank",
    duration: 3,
    elbow: -1,
    knee: 1,
    hold: true,
    keys: loop({ hip: [118, 176], sh: [170, 172], hand: [196, 198], foot: [46, 196] }, { hip: [118, 174], sh: [170, 171], hand: [196, 198], foot: [46, 196] }, 0.2),
    cue: "Squeeze glutes, brace abs, keep breathing.",
  },
  wallsit: {
    id: "wallsit",
    label: "Wall sit",
    duration: 3,
    elbow: 1,
    knee: -1,
    hold: true,
    keys: loop({ hip: [78, 142], sh: [74, 90], hand: [96, 140], foot: [124, 198] }, { hip: [78, 143], sh: [74, 91], hand: [96, 141], foot: [124, 198] }, 0.2),
    props: [{ type: "wall", x: 60 }],
    cue: "Back flat on the wall, knees at 90°.",
  },
  pullup: {
    id: "pullup",
    label: "Pull-up",
    duration: 2.8,
    elbow: -1,
    knee: -1,
    keys: loop({ hip: [118, 120], sh: [122, 68], hand: [128, 14], foot: [104, 186] }, { hip: [118, 86], sh: [124, 34], hand: [128, 14], foot: [104, 152] }),
    props: [{ type: "bar", x1: 92, x2: 164, y: 12 }],
    cue: "Drive elbows down to your sides until your chin clears the bar.",
  },
  pulldown: {
    id: "pulldown",
    label: "Lat pulldown",
    duration: 2.6,
    elbow: -1,
    knee: -1,
    keys: loop({ hip: [110, 146], sh: [112, 94], hand: [118, 32], foot: [156, 198] }, { hip: [110, 146], sh: [110, 94], hand: [128, 86], foot: [156, 198] }),
    props: [
      { type: "seat", x: 86, y: 150, w: 48 },
      { type: "cable", from: [118, 0] },
    ],
    cue: "Lean back slightly and pull the bar to your upper chest.",
  },
  dip: {
    id: "dip",
    label: "Dip",
    duration: 2.6,
    elbow: 1,
    knee: -1,
    keys: loop({ hip: [118, 116], sh: [124, 62], hand: [128, 118], foot: [100, 172] }, { hip: [112, 146], sh: [118, 94], hand: [128, 118], foot: [96, 196] }),
    props: [{ type: "bar", x1: 112, x2: 150, y: 120 }],
    cue: "Lower until elbows reach 90°, then press back up.",
  },
  burpee: {
    id: "burpee",
    label: "Burpee",
    duration: 3.6,
    elbow: 1,
    knee: -1,
    keys: [
      { t: 0, pose: STAND },
      { t: 0.18, pose: CROUCH },
      { t: 0.34, pose: PUSH_TOP },
      { t: 0.48, pose: PUSH_TOP },
      { t: 0.62, pose: CROUCH },
      { t: 0.8, pose: { hip: [120, 104], sh: [120, 52], hand: [128, 2], foot: [122, 184] } },
      { t: 1, pose: STAND },
    ],
    cue: "Squat, kick back to a plank, jump in, jump up.",
  },
  curl: {
    id: "curl",
    label: "Biceps curl",
    duration: 2.4,
    elbow: 1,
    knee: -1,
    keys: loop({ ...STAND, hand: [124, 124] }, { ...STAND, hand: [138, 72] }),
    props: [{ type: "dumbbell", at: "hand" }],
    cue: "Elbows pinned to your sides; only the forearm moves.",
  },
  press: {
    id: "press",
    label: "Overhead press",
    duration: 2.6,
    elbow: 1,
    knee: -1,
    keys: loop({ ...STAND, hand: [140, 68] }, { ...STAND, hand: [126, 8] }),
    props: [{ type: "dumbbell", at: "hand" }],
    cue: "Brace your core and press straight up; don't arch your back.",
  },
  raise: {
    id: "raise",
    label: "Raise",
    duration: 2.6,
    elbow: 1,
    knee: -1,
    keys: loop({ ...STAND, hand: [124, 124] }, { ...STAND, hand: [176, 64] }),
    props: [{ type: "dumbbell", at: "hand" }],
    cue: "Lift to shoulder height with a soft elbow, lower slowly.",
  },
  triceps: {
    id: "triceps",
    label: "Triceps extension",
    duration: 2.4,
    elbow: -1,
    knee: -1,
    keys: loop({ ...STAND, hand: [106, 50] }, { ...STAND, hand: [126, 8] }),
    props: [{ type: "dumbbell", at: "hand" }],
    cue: "Keep elbows pointing up; straighten the arms overhead.",
  },
  bench: {
    id: "bench",
    label: "Bench press",
    duration: 2.6,
    elbow: 1,
    knee: 1,
    keys: loop({ hip: [112, 152], sh: [164, 152], hand: [166, 96], foot: [74, 198] }, { hip: [112, 152], sh: [164, 152], hand: [164, 130], foot: [74, 198] }),
    props: [
      { type: "bench", x: 40, y: 160, w: 140 },
      { type: "barbell", at: "hand" },
    ],
    cue: "Lower the bar to mid-chest, press back up over your shoulders.",
  },
  row: {
    id: "row",
    label: "Bent-over row",
    duration: 2.4,
    elbow: 1,
    knee: -1,
    keys: loop({ hip: [102, 120], sh: [146, 94], hand: [150, 152], foot: [122, 198] }, { hip: [102, 120], sh: [146, 94], hand: [128, 126], foot: [122, 198] }),
    props: [{ type: "dumbbell", at: "hand" }],
    cue: "Flat back, pull the weight to your hip, squeeze your shoulder blades.",
  },
  deadlift: {
    id: "deadlift",
    label: "Deadlift",
    duration: 3,
    elbow: 1,
    knee: -1,
    keys: loop({ hip: [94, 150], sh: [138, 122], hand: [136, 178], foot: [126, 198] }, { hip: [120, 118], sh: [122, 66], hand: [124, 124], foot: [126, 198] }),
    props: [{ type: "barbell", at: "hand" }],
    cue: "Push the floor away; bar stays close to your legs, back flat.",
  },
  rdl: {
    id: "rdl",
    label: "Romanian deadlift",
    duration: 3,
    elbow: 1,
    knee: -1,
    keys: loop({ hip: [120, 118], sh: [122, 66], hand: [124, 124], foot: [126, 198] }, { hip: [98, 124], sh: [146, 104], hand: [146, 160], foot: [126, 198] }),
    props: [{ type: "dumbbell", at: "hand" }],
    cue: "Hinge at the hips with soft knees until you feel the hamstrings stretch.",
  },
  hipthrust: {
    id: "hipthrust",
    label: "Hip thrust",
    duration: 2.6,
    elbow: 1,
    knee: -1,
    keys: loop({ hip: [100, 172], sh: [64, 130], hand: [100, 166], foot: [146, 198] }, { hip: [114, 130], sh: [64, 130], hand: [114, 124], foot: [146, 198] }),
    props: [
      { type: "bench", x: 20, y: 136, w: 52 },
      { type: "barbell", at: "hip" },
    ],
    cue: "Drive through your heels and squeeze your glutes at the top.",
  },
  swing: {
    id: "swing",
    label: "Kettlebell swing",
    duration: 2,
    elbow: 1,
    knee: -1,
    keys: loop({ hip: [100, 124], sh: [144, 96], hand: [118, 166], foot: [122, 198] }, { hip: [120, 118], sh: [122, 66], hand: [176, 70], foot: [122, 198] }, 0.02),
    props: [{ type: "kettlebell", at: "hand" }],
    cue: "Snap the hips forward; the arms just guide the bell.",
  },
  legpress: {
    id: "legpress",
    label: "Leg press",
    duration: 2.8,
    elbow: 1,
    knee: -1,
    keys: loop({ hip: [96, 168], sh: [58, 136], hand: [92, 166], foot: [152, 108] }, { hip: [96, 168], sh: [58, 136], hand: [92, 166], foot: [126, 134] }),
    props: [{ type: "seat", x: 40, y: 172, w: 70 }, { type: "platform" }],
    cue: "Lower until knees reach 90°, press through your whole foot.",
  },
};

const RULES: [RegExp, string][] = [
  [/push-?\s?up/i, "pushup"],
  [/leg press/i, "legpress"],
  [/bench press|chest press|floor press/i, "bench"],
  [/goblet/i, "goblet"],
  [/squat|sit-to-stand/i, "squat"],
  [/lunge|split squat|step-?\s?up/i, "lunge"],
  [/sit-?\s?up|crunch|v-?\s?up/i, "situp"],
  [/plank/i, "plank"],
  [/wall sit/i, "wallsit"],
  [/pull-?\s?down/i, "pulldown"],
  [/pull-?\s?up|chin-?\s?up/i, "pullup"],
  [/\bdips?\b/i, "dip"],
  [/burpee/i, "burpee"],
  [/curl/i, "curl"],
  [/romanian|\brdl\b|good morning|stiff.?leg/i, "rdl"],
  [/deadlift/i, "deadlift"],
  [/thrust|glute bridge|hip bridge/i, "hipthrust"],
  [/swing/i, "swing"],
  [/extension|skull|kickback|triceps?/i, "triceps"],
  [/raise/i, "raise"],
  [/\brow\b|rows\b/i, "row"],
  [/press/i, "press"],
];

export function motionFor(name: string, explicit?: string): Motion | null {
  if (explicit && MOTIONS[explicit]) return MOTIONS[explicit];
  for (const [re, id] of RULES) if (re.test(name)) return MOTIONS[id];
  return null;
}

// ---------- Interpolation & kinematics ----------

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpP = (a: P, b: P, t: number): P => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const ease = (t: number) => t * t * (3 - 2 * t);

export function poseAt(m: Motion, phase: number): Pose {
  const t = ((phase % 1) + 1) % 1;
  const keys = m.keys;
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const local = b.t === a.t ? 0 : ease(Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))));
  const pa = a.pose;
  const pb = b.pose;
  return {
    hip: lerpP(pa.hip, pb.hip, local),
    sh: lerpP(pa.sh, pb.sh, local),
    hand: lerpP(pa.hand, pb.hand, local),
    foot: lerpP(pa.foot, pb.foot, local),
    hand2: pa.hand2 && pb.hand2 ? lerpP(pa.hand2, pb.hand2, local) : undefined,
    foot2: pa.foot2 && pb.foot2 ? lerpP(pa.foot2, pb.foot2, local) : undefined,
  };
}

/** Two-bone IK: returns the middle joint (elbow/knee) and the clamped end point. */
export function solveLimb(root: P, target: P, a: number, b: number, bend: 1 | -1): { joint: P; end: P } {
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  const dist = Math.hypot(dx, dy) || 0.0001;
  const ux = dx / dist;
  const uy = dy / dist;
  const d = Math.min(Math.max(dist, Math.abs(a - b) + 0.5), a + b - 0.01);
  const cos = (a * a + d * d - b * b) / (2 * a * d);
  const alpha = Math.acos(Math.max(-1, Math.min(1, cos))) * bend;
  const jx = ux * Math.cos(alpha) - uy * Math.sin(alpha);
  const jy = ux * Math.sin(alpha) + uy * Math.cos(alpha);
  const joint: P = [root[0] + jx * a, root[1] + jy * a];
  const end: P = [root[0] + ux * d, root[1] + uy * d];
  return { joint, end };
}

export const BONES = { upperArm: 30, forearm: 28, thigh: 42, shin: 40 };
