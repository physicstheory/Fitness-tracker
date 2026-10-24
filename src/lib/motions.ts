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
  | { type: "platform" }
  | { type: "box"; x: number; y: number; w: number };

export interface Motion {
  id: string;
  label: string;
  /** Seconds per repetition. */
  duration: number;
  keys: { t: number; pose: Pose }[];
  /** +1 bends the joint toward the figure's back, -1 toward its front. */
  elbow: 1 | -1;
  elbow2?: 1 | -1;
  knee: 1 | -1;
  knee2?: 1 | -1;
  /** Labels for the first and second half of each rep, e.g. ["Lower", "Press"]. */
  phases?: [string, string];
  props?: Prop[];
  /** Static holds just "breathe" between their keyframes. */
  hold?: boolean;
  /** Drawn facing the other way (lying face up with the head on the right, or face down with the head on the left). */
  mirrored?: boolean;
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
    phases: ["Lower", "Push up"],
    label: "Push-up",
    duration: 2.4,
    elbow: 1,
    knee: 1,
    keys: loop(PUSH_TOP, { hip: [142, 185], sh: [196, 178], hand: [180, 198], foot: [59, 197] }),
    cue: "Body stays in one straight line from head to heels.",
  },
  squat: {
    id: "squat",
    phases: ["Sit back", "Stand"],
    label: "Squat",
    duration: 2.6,
    elbow: -1,
    knee: -1,
    keys: loop({ hip: [120, 118], sh: [120, 66], hand: [176, 70], foot: [124, 198] }, { hip: [92, 158], sh: [122, 116], hand: [178, 114], foot: [124, 198] }),
    cue: "Hips back and down, chest up, knees track over toes.",
  },
  goblet: {
    id: "goblet",
    phases: ["Sit back", "Stand"],
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
    phases: ["Lower", "Drive up"],
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
    phases: ["Curl up", "Lower"],
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
    phases: ["Pull", "Lower"],
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
    phases: ["Pull", "Return"],
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
    phases: ["Lower", "Press"],
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
    phases: ["Down", "Jump"],
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
    phases: ["Curl", "Lower"],
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
    phases: ["Press", "Lower"],
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
    phases: ["Raise", "Lower"],
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
    phases: ["Extend", "Lower"],
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
    mirrored: true,
    phases: ["Lower", "Press"],
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
    phases: ["Pull", "Lower"],
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
    phases: ["Lift", "Lower"],
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
    phases: ["Hinge", "Stand"],
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
    phases: ["Drive", "Lower"],
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
    phases: ["Hike", "Snap"],
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
    phases: ["Lower", "Press"],
    label: "Leg press",
    duration: 2.8,
    elbow: 1,
    knee: -1,
    keys: loop({ hip: [96, 168], sh: [58, 136], hand: [92, 166], foot: [152, 108] }, { hip: [96, 168], sh: [58, 136], hand: [92, 166], foot: [126, 134] }),
    props: [{ type: "seat", x: 40, y: 172, w: 70 }, { type: "platform" }],
    cue: "Lower until knees reach 90°, press through your whole foot.",
  },
  // ---- Added movements ----
  calfraise: {
    id: "calfraise",
    label: "Calf raise",
    duration: 2,
    elbow: 1,
    knee: -1,
    phases: ["Rise", "Lower"],
    keys: loop(STAND, { hip: [121, 108], sh: [121, 56], hand: [123, 114], foot: [124, 188] }),
    cue: "Rise onto the balls of your feet, pause, lower slowly.",
  },
  bridge: {
    id: "bridge",
    label: "Glute bridge",
    duration: 2.4,
    elbow: 1,
    knee: -1,
    phases: ["Drive", "Lower"],
    keys: loop({ hip: [100, 192], sh: [50, 194], hand: [96, 196], foot: [142, 198] }, { hip: [104, 160], sh: [56, 192], hand: [96, 196], foot: [142, 198] }),
    cue: "Push through your heels and squeeze your glutes at the top.",
  },
  legraise: {
    id: "legraise",
    label: "Leg raise",
    duration: 2.8,
    elbow: 1,
    knee: 1,
    phases: ["Raise", "Lower"],
    keys: loop({ hip: [110, 194], sh: [58, 194], hand: [104, 198], foot: [192, 196] }, { hip: [110, 194], sh: [58, 194], hand: [104, 198], foot: [122, 112] }),
    cue: "Lower back pressed down; lower your legs slowly.",
  },
  crunch: {
    id: "crunch",
    label: "Crunch",
    duration: 2,
    elbow: 1,
    knee: -1,
    phases: ["Crunch", "Lower"],
    keys: loop({ hip: [120, 190], sh: [68, 190], hand: [70, 176], foot: [166, 198] }, { hip: [120, 190], sh: [78, 168], hand: [86, 158], foot: [166, 198] }),
    cue: "Lift your shoulder blades, not your neck.",
  },
  mountain: {
    id: "mountain",
    label: "Mountain climber",
    duration: 1.2,
    elbow: 1,
    knee: -1,
    knee2: -1,
    phases: ["Drive", "Switch"],
    keys: loop(
      { hip: [136, 160], sh: [184, 144], hand: [180, 198], foot: [59, 197], foot2: [148, 190] },
      { hip: [136, 160], sh: [184, 144], hand: [180, 198], foot: [148, 190], foot2: [59, 197] },
      0.02,
    ),
    cue: "Hips level, drive the knees fast toward your chest.",
  },
  jack: {
    id: "jack",
    label: "Jumping jack",
    duration: 1.1,
    elbow: 1,
    knee: -1,
    phases: ["Out", "In"],
    keys: loop(STAND, { hip: [120, 110], sh: [120, 58], hand: [128, 0], foot: [122, 194] }, 0.02),
    cue: "Land softly; arms all the way overhead.",
  },
  twist: {
    id: "twist",
    label: "Russian twist",
    duration: 1.6,
    elbow: 1,
    knee: -1,
    phases: ["Left", "Right"],
    keys: loop({ hip: [118, 192], sh: [96, 146], hand: [142, 160], foot: [168, 176] }, { hip: [118, 192], sh: [94, 146], hand: [112, 170], foot: [168, 176] }, 0.04),
    cue: "Lean back, keep the chest up and rotate from your ribs.",
  },
  shrug: {
    id: "shrug",
    label: "Shrug",
    duration: 1.8,
    elbow: 1,
    knee: -1,
    phases: ["Shrug", "Lower"],
    keys: loop({ ...STAND, hand: [124, 124] }, { hip: [120, 118], sh: [120, 60], hand: [124, 118], foot: [122, 198] }),
    props: [{ type: "dumbbell", at: "hand" }],
    cue: "Shoulders straight up to your ears, no rolling.",
  },
  fly: {
    id: "fly",
    mirrored: true,
    label: "Chest fly",
    duration: 2.8,
    elbow: 1,
    knee: 1,
    phases: ["Open", "Squeeze"],
    keys: loop({ hip: [112, 152], sh: [164, 152], hand: [168, 96], foot: [74, 198] }, { hip: [112, 152], sh: [164, 152], hand: [150, 146], foot: [74, 198] }),
    props: [
      { type: "bench", x: 40, y: 160, w: 140 },
      { type: "dumbbell", at: "hand" },
    ],
    cue: "Soft elbows; open wide until you feel a stretch, then hug back up.",
  },
  skull: {
    id: "skull",
    mirrored: true,
    label: "Skull crusher",
    duration: 2.4,
    elbow: -1,
    knee: 1,
    phases: ["Lower", "Extend"],
    keys: loop({ hip: [112, 152], sh: [164, 152], hand: [168, 96], foot: [74, 198] }, { hip: [112, 152], sh: [164, 152], hand: [190, 128], foot: [74, 198] }),
    props: [
      { type: "bench", x: 40, y: 160, w: 140 },
      { type: "dumbbell", at: "hand" },
    ],
    cue: "Upper arms still; bend only at the elbows.",
  },
  pullover: {
    id: "pullover",
    mirrored: true,
    label: "Pullover",
    duration: 3,
    elbow: 1,
    knee: 1,
    phases: ["Reach", "Pull"],
    keys: loop({ hip: [112, 152], sh: [164, 152], hand: [168, 96], foot: [74, 198] }, { hip: [112, 152], sh: [164, 152], hand: [218, 140], foot: [74, 198] }),
    props: [
      { type: "bench", x: 40, y: 160, w: 140 },
      { type: "dumbbell", at: "hand" },
    ],
    cue: "Arms nearly straight; reach back until your lats stretch.",
  },
  legcurl: {
    id: "legcurl",
    mirrored: true,
    label: "Leg curl",
    duration: 2.4,
    elbow: 1,
    knee: 1,
    phases: ["Curl", "Lower"],
    keys: loop({ hip: [116, 152], sh: [66, 152], hand: [44, 162], foot: [196, 156] }, { hip: [116, 152], sh: [66, 152], hand: [44, 162], foot: [146, 100] }),
    props: [{ type: "bench", x: 40, y: 160, w: 120 }],
    cue: "Hips pressed into the pad; curl your heels toward your glutes.",
  },
  legext: {
    id: "legext",
    label: "Leg extension",
    duration: 2.4,
    elbow: 1,
    knee: -1,
    phases: ["Extend", "Lower"],
    keys: loop({ hip: [100, 150], sh: [96, 98], hand: [104, 152], foot: [138, 196] }, { hip: [100, 150], sh: [96, 98], hand: [104, 152], foot: [180, 142] }),
    props: [{ type: "seat", x: 74, y: 154, w: 52 }],
    cue: "Straighten fully and squeeze your quads at the top.",
  },
  stepup: {
    id: "stepup",
    label: "Step-up",
    duration: 2.6,
    elbow: 1,
    knee: -1,
    knee2: -1,
    phases: ["Step up", "Step down"],
    keys: loop(
      { hip: [118, 120], sh: [120, 68], hand: [122, 126], foot: [158, 158], foot2: [114, 198] },
      { hip: [150, 82], sh: [152, 30], hand: [154, 88], foot: [158, 158], foot2: [162, 156] },
    ),
    props: [{ type: "box", x: 136, y: 162, w: 56 }],
    cue: "Drive through the heel on the box; don't push off the back foot.",
  },
  pushdown: {
    id: "pushdown",
    label: "Triceps pushdown",
    duration: 2,
    elbow: 1,
    knee: -1,
    phases: ["Push", "Return"],
    keys: loop({ hip: [118, 118], sh: [124, 66], hand: [146, 86], foot: [120, 198] }, { hip: [118, 118], sh: [124, 66], hand: [134, 124], foot: [120, 198] }),
    props: [{ type: "cable", from: [150, 0] }],
    cue: "Elbows glued to your sides; lock out at the bottom.",
  },
  uprightrow: {
    id: "uprightrow",
    label: "Upright row",
    duration: 2.2,
    elbow: -1,
    knee: -1,
    phases: ["Pull up", "Lower"],
    keys: loop({ ...STAND, hand: [126, 124] }, { ...STAND, hand: [130, 72] }),
    props: [{ type: "barbell", at: "hand" }],
    cue: "Lead with the elbows; stop at chest height.",
  },
  facepull: {
    id: "facepull",
    label: "Face pull",
    duration: 2.2,
    elbow: 1,
    knee: -1,
    phases: ["Pull", "Return"],
    keys: loop({ ...STAND, hand: [178, 64] }, { ...STAND, hand: [134, 56] }),
    props: [{ type: "cable", from: [236, 60] }],
    cue: "Pull the rope toward your forehead, elbows high and wide.",
  },
  superman: {
    id: "superman",
    mirrored: true,
    label: "Superman",
    duration: 2.4,
    elbow: 1,
    knee: 1,
    phases: ["Lift", "Lower"],
    keys: loop({ hip: [120, 194], sh: [70, 194], hand: [24, 194], foot: [200, 196] }, { hip: [120, 192], sh: [72, 180], hand: [26, 170], foot: [198, 178] }),
    cue: "Lift chest and legs together; squeeze your lower back and glutes.",
  },
  birddog: {
    id: "birddog",
    label: "Bird dog",
    duration: 3,
    elbow: 1,
    knee: 1,
    knee2: -1,
    phases: ["Reach", "Return"],
    keys: loop(
      { hip: [104, 150], sh: [154, 150], hand: [154, 198], hand2: [154, 198], foot: [100, 198], foot2: [72, 198] },
      { hip: [104, 150], sh: [154, 150], hand: [210, 146], hand2: [154, 198], foot: [24, 146], foot2: [72, 198] },
    ),
    cue: "Reach long with the opposite arm and leg; keep your hips level.",
  },
  walk: {
    id: "walk",
    label: "Walk",
    duration: 1.4,
    elbow: 1,
    elbow2: 1,
    knee: -1,
    knee2: -1,
    phases: ["Left", "Right"],
    keys: loop(
      { hip: [120, 120], sh: [122, 68], hand: [138, 120], hand2: [104, 120], foot: [146, 198], foot2: [96, 198] },
      { hip: [120, 120], sh: [122, 68], hand: [104, 120], hand2: [138, 120], foot: [96, 198], foot2: [146, 198] },
      0.02,
    ),
    props: [{ type: "kettlebell", at: "hand" }],
    cue: "Tall posture, tight core, short quick steps.",
  },
  run: {
    id: "run",
    label: "Run",
    duration: 0.8,
    elbow: -1,
    elbow2: -1,
    knee: -1,
    knee2: 1,
    phases: ["Left", "Right"],
    keys: loop(
      { hip: [120, 112], sh: [126, 60], hand: [146, 96], hand2: [104, 110], foot: [150, 186], foot2: [88, 170] },
      { hip: [120, 112], sh: [126, 60], hand: [104, 110], hand2: [146, 96], foot: [88, 170], foot2: [150, 186] },
      0.02,
    ),
    cue: "Land under your hips; drive the arms.",
  },
  highknees: {
    id: "highknees",
    label: "High knees",
    duration: 0.7,
    elbow: -1,
    elbow2: -1,
    knee: -1,
    knee2: -1,
    phases: ["Left", "Right"],
    keys: loop(
      { hip: [120, 116], sh: [121, 64], hand: [146, 92], hand2: [110, 110], foot: [122, 196], foot2: [140, 150] },
      { hip: [120, 116], sh: [121, 64], hand: [110, 110], hand2: [146, 92], foot: [140, 150], foot2: [122, 196] },
      0.02,
    ),
    cue: "Knees to hip height, stay on the balls of your feet.",
  },
  bike: {
    id: "bike",
    label: "Cycling",
    duration: 1.2,
    elbow: 1,
    knee: -1,
    knee2: -1,
    phases: ["Push", "Pull"],
    keys: [
      { t: 0, pose: { hip: [96, 120], sh: [140, 84], hand: [172, 96], foot: [130, 186], foot2: [118, 150] } },
      { t: 0.25, pose: { hip: [96, 120], sh: [140, 84], hand: [172, 96], foot: [142, 168], foot2: [106, 168] } },
      { t: 0.5, pose: { hip: [96, 120], sh: [140, 84], hand: [172, 96], foot: [118, 150], foot2: [130, 186] } },
      { t: 0.75, pose: { hip: [96, 120], sh: [140, 84], hand: [172, 96], foot: [106, 168], foot2: [142, 168] } },
      { t: 1, pose: { hip: [96, 120], sh: [140, 84], hand: [172, 96], foot: [130, 186], foot2: [118, 150] } },
    ],
    props: [{ type: "seat", x: 80, y: 124, w: 30 }],
    cue: "Smooth circles; knees track straight over the pedals.",
  },
  rower: {
    id: "rower",
    label: "Rowing machine",
    duration: 2.2,
    elbow: 1,
    knee: -1,
    phases: ["Drive", "Recover"],
    keys: loop(
      { hip: [100, 180], sh: [128, 136], hand: [176, 160], foot: [150, 186] },
      { hip: [62, 180], sh: [56, 128], hand: [86, 150], foot: [146, 188] },
      0.04,
    ),
    props: [{ type: "seat", x: 40, y: 186, w: 130 }],
    cue: "Legs, then lean back, then arms; reverse on the way forward.",
  },
  boxjump: {
    id: "boxjump",
    label: "Box jump",
    duration: 2.4,
    elbow: 1,
    knee: -1,
    phases: ["Load", "Jump"],
    keys: [
      { t: 0, pose: { hip: [96, 118], sh: [98, 66], hand: [100, 124], foot: [98, 198] } },
      { t: 0.3, pose: { hip: [80, 156], sh: [110, 114], hand: [70, 150], foot: [100, 198] } },
      { t: 0.55, pose: { hip: [130, 90], sh: [136, 38], hand: [150, 10], foot: [140, 140] } },
      { t: 0.75, pose: { hip: [146, 128], sh: [172, 84], hand: [190, 110], foot: [166, 158] } },
      { t: 1, pose: { hip: [96, 118], sh: [98, 66], hand: [100, 124], foot: [98, 198] } },
    ],
    props: [{ type: "box", x: 140, y: 162, w: 60 }],
    cue: "Swing the arms, land softly with bent knees, step down.",
  },
  thruster: {
    id: "thruster",
    label: "Thruster",
    duration: 2.6,
    elbow: 1,
    knee: -1,
    phases: ["Squat", "Drive & press"],
    keys: loop({ hip: [92, 158], sh: [122, 116], hand: [140, 110], foot: [124, 198] }, { hip: [120, 118], sh: [120, 66], hand: [126, 8], foot: [124, 198] }),
    props: [{ type: "dumbbell", at: "hand" }],
    cue: "Use the drive out of the squat to press overhead.",
  },
  invrow: {
    id: "invrow",
    mirrored: true,
    label: "Inverted row",
    duration: 2.4,
    elbow: 1,
    knee: 1,
    phases: ["Pull", "Lower"],
    keys: loop({ hip: [122, 166], sh: [168, 150], hand: [176, 96], foot: [42, 196] }, { hip: [122, 150], sh: [170, 118], hand: [176, 96], foot: [42, 196] }),
    props: [{ type: "bar", x1: 150, x2: 210, y: 94 }],
    cue: "Body straight like a plank; pull your chest to the bar.",
  },
  pike: {
    id: "pike",
    label: "Pike push-up",
    duration: 2.4,
    elbow: 1,
    knee: 1,
    phases: ["Lower", "Press"],
    keys: loop({ hip: [118, 110], sh: [148, 152], hand: [160, 198], foot: [70, 196] }, { hip: [120, 118], sh: [146, 168], hand: [160, 198], foot: [70, 196] }),
    cue: "Hips high; lower the top of your head toward the floor.",
  },
  ropes: {
    id: "ropes",
    label: "Battle ropes",
    duration: 0.7,
    elbow: 1,
    knee: -1,
    phases: ["Up", "Down"],
    keys: loop({ hip: [104, 138], sh: [128, 92], hand: [168, 110], foot: [122, 198] }, { hip: [104, 140], sh: [128, 94], hand: [168, 142], foot: [122, 198] }, 0.02),
    cue: "Half squat, brace, make fast waves from the shoulders.",
  },
  rope: {
    id: "rope",
    label: "Jump rope",
    duration: 0.5,
    elbow: 1,
    knee: -1,
    phases: ["Hop", "Land"],
    keys: loop({ ...STAND, hand: [134, 124] }, { hip: [120, 110], sh: [120, 58], hand: [134, 116], foot: [124, 190] }, 0.02),
    cue: "Small hops on the balls of your feet; turn the rope with your wrists.",
  },
};

const RULES: [RegExp, string][] = [
  [/pike/i, "pike"],
  [/mountain climber/i, "mountain"],
  [/push-?\s?up/i, "pushup"],
  [/leg press/i, "legpress"],
  [/leg curl|hamstring curl|nordic/i, "legcurl"],
  [/leg extension/i, "legext"],
  [/skull|lying triceps|french press/i, "skull"],
  [/pullover/i, "pullover"],
  [/\bfly\b|flye|crossover|pec deck/i, "fly"],
  [/bench press|chest press|floor press|incline press|decline press|close-?grip/i, "bench"],
  [/thruster|wall ball/i, "thruster"],
  [/goblet/i, "goblet"],
  [/box jump/i, "boxjump"],
  [/step-?\s?up/i, "stepup"],
  [/calf/i, "calfraise"],
  [/squat|sit-to-stand/i, "squat"],
  [/lunge|split squat/i, "lunge"],
  [/russian twist|twist/i, "twist"],
  [/leg raise|knee raise|flutter|scissor/i, "legraise"],
  [/crunch|dead bug/i, "crunch"],
  [/sit-?\s?up|v-?\s?up/i, "situp"],
  [/plank/i, "plank"],
  [/wall sit/i, "wallsit"],
  [/bird dog/i, "birddog"],
  [/superman|back extension|hyperextension/i, "superman"],
  [/inverted row|australian/i, "invrow"],
  [/pull-?\s?down/i, "pulldown"],
  [/pull-?\s?up|chin-?\s?up/i, "pullup"],
  [/\bdips?\b/i, "dip"],
  [/burpee/i, "burpee"],
  [/jumping jack|star jump/i, "jack"],
  [/high knees|butt kick/i, "highknees"],
  [/jump rope|skipping/i, "rope"],
  [/battle rope/i, "ropes"],
  [/rowing machine|\berg\b|rower/i, "rower"],
  [/bike|cycl|spin/i, "bike"],
  [/run|sprint|jog/i, "run"],
  [/farmer|carry|walk/i, "walk"],
  [/shrug/i, "shrug"],
  [/face pull/i, "facepull"],
  [/upright row/i, "uprightrow"],
  [/pushdown|push-down/i, "pushdown"],
  [/curl/i, "curl"],
  [/romanian|\brdl\b|good morning|stiff.?leg/i, "rdl"],
  [/deadlift|clean|snatch/i, "deadlift"],
  [/glute bridge|hip bridge|bridge/i, "bridge"],
  [/thrust/i, "hipthrust"],
  [/swing/i, "swing"],
  [/extension|kickback|triceps?/i, "triceps"],
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
