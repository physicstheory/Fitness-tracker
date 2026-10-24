import { useEffect, useId, useRef, useState } from "react";
import type { JSX } from "react";
import { BONES, poseAt, solveLimb, type Motion, type P, type Pose, type Prop } from "../lib/motions";
import type { MuscleId } from "../lib/muscles";

const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Plays a looping form demo for one movement, with the current phase ("Lower", "Press") underneath. */
export function FormAnimation({
  motion,
  playing = true,
  size = 260,
  showPhase = true,
  muscles,
}: {
  motion: Motion;
  playing?: boolean;
  size?: number;
  showPhase?: boolean;
  /** Highlight these muscles on the figure as they work. */
  muscles?: { primary: MuscleId[]; secondary: MuscleId[] };
}) {
  const [phase, setPhase] = useState(0);
  const start = useRef(performance.now());

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const slow = reduceMotion() ? 2.5 : 1;
    const tick = (now: number) => {
      setPhase(((now - start.current) / 1000 / (motion.duration * slow)) % 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [motion, playing]);

  const labels = motion.phases ?? (motion.hold ? ["Hold", "Breathe"] : null);
  const active = phase < 0.5 ? 0 : 1;
  return (
    <div style={{ width: "100%" }}>
      <Figure motion={motion} phase={phase} size={size} muscles={muscles} />
      {showPhase && labels && (
        <div className="fa-phases" aria-hidden>
          {labels.map((l, i) => (
            <span key={l} className={i === active ? "on" : ""}>
              {l}
            </span>
          ))}
          <div className="fa-tempo">
            <div style={{ width: `${(phase % 0.5) * 200}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

/** A limb segment that tapers from radius r1 at a to r2 at b. */
function capsule(a: P, b: P, r1: number, r2: number): string {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 0.001;
  const nx = -dy / l;
  const ny = dx / l;
  const f = (n: number) => n.toFixed(1);
  return [
    `M${f(a[0] + nx * r1)} ${f(a[1] + ny * r1)}`,
    `L${f(b[0] + nx * r2)} ${f(b[1] + ny * r2)}`,
    `A${r2} ${r2} 0 0 1 ${f(b[0] - nx * r2)} ${f(b[1] - ny * r2)}`,
    `L${f(a[0] - nx * r1)} ${f(a[1] - ny * r1)}`,
    `A${r1} ${r1} 0 0 1 ${f(a[0] + nx * r1)} ${f(a[1] + ny * r1)}Z`,
  ].join(" ");
}

interface Rig {
  pose: Pose;
  arm: { joint: P; end: P };
  leg: { joint: P; end: P };
  arm2: { joint: P; end: P } | null;
  leg2: { joint: P; end: P } | null;
  head: P;
  headAngle: number;
}

function rig(motion: Motion, phase: number): Rig {
  const pose = poseAt(motion, phase);
  const tx = pose.sh[0] - pose.hip[0];
  const ty = pose.sh[1] - pose.hip[1];
  const tl = Math.hypot(tx, ty) || 1;
  return {
    pose,
    arm: solveLimb(pose.sh, pose.hand, BONES.upperArm, BONES.forearm, motion.elbow),
    leg: solveLimb(pose.hip, pose.foot, BONES.thigh, BONES.shin, motion.knee),
    arm2: pose.hand2 ? solveLimb(pose.sh, pose.hand2, BONES.upperArm, BONES.forearm, motion.elbow2 ?? motion.elbow) : null,
    leg2: pose.foot2 ? solveLimb(pose.hip, pose.foot2, BONES.thigh, BONES.shin, motion.knee2 ?? motion.knee) : null,
    head: [pose.sh[0] + (tx / tl) * 20, pose.sh[1] + (ty / tl) * 20],
    headAngle: (Math.atan2(ty, tx) * 180) / Math.PI + 90,
  };
}

/** Rotate the shin direction 90° toward the front to get the foot. */
function footTip(knee: P, ankle: P): P {
  const sx = ankle[0] - knee[0];
  const sy = ankle[1] - knee[1];
  const l = Math.hypot(sx, sy) || 1;
  return [ankle[0] + (sy / l) * 12, ankle[1] - (sx / l) * 12];
}

const shift = (p: P, d: P = [-3, -2]): P => [p[0] + d[0], p[1] + d[1]];

export interface Working {
  primary: Set<MuscleId>;
  secondary: Set<MuscleId>;
  /** 0–1 contraction strength right now. */
  a: number;
  /** The figure is drawn mirrored (see Motion.mirrored). */
  mirrored?: boolean;
}

const add = (a: P, b: P, k = 1): P => [a[0] + b[0] * k, a[1] + b[1] * k];
const unit = (a: P, b: P): P => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  return [dx / l, dy / l];
};
/** Perpendicular pointing to the figure's front when the segment points from a to b. */
const front = (d: P): P => [-d[1], d[0]];

/** Orange overlays on the body segments for the muscles doing the work. */
function MuscleOverlays({ r, w, part }: { r: Rig; w: Working; part: "torso" | "leg" | "arm" }) {
  const { pose, arm, leg } = r;
  // Chest-side normal of the torso. Rotating the torso direction by 90° gives the front for a figure
  // that faces right when standing; mirrored figures use the other side.
  const td = unit(pose.hip, pose.sh);
  const chestN: P = w.mirrored ? [td[1], -td[0]] : [-td[1], td[0]];
  const dot = (a: P, b: P) => a[0] * b[0] + a[1] * b[1];
  const tone = (m: MuscleId) => (w.primary.has(m) ? { fill: "#ff5a36", opacity: 0.35 + 0.6 * w.a } : w.secondary.has(m) ? { fill: "#ffa45c", opacity: 0.2 + 0.35 * w.a } : null);
  const shapes: JSX.Element[] = [];
  const put = (m: MuscleId, el: (style: { fill: string; opacity: number }) => JSX.Element) => {
    const t = tone(m);
    if (t) shapes.push(el(t));
  };
  if (part === "torso") {
    const d = td;
    const n = chestN;
    const L = Math.hypot(pose.sh[0] - pose.hip[0], pose.sh[1] - pose.hip[1]);
    const at = (k: number, side: number) => add(add(pose.hip, d, L * k), n, side);
    put("glutes", (st) => <circle key="gl" cx={add(pose.hip, n, -5)[0]} cy={add(pose.hip, n, -5)[1]} r={8.5} style={st} />);
    put("hip_flexors", (st) => <circle key="hf" cx={add(pose.hip, n, 6)[0]} cy={add(pose.hip, n, 6)[1]} r={5} style={st} />);
    put("lower_back", (st) => <path key="lb" d={capsule(at(0.12, -7), at(0.45, -7.5), 4, 4)} style={st} />);
    put("lats", (st) => <path key="la" d={capsule(at(0.4, -6), at(0.85, -7), 5, 7)} style={st} />);
    put("upper_back", (st) => <path key="ub" d={capsule(at(0.72, -8), at(0.95, -8), 5, 5)} style={st} />);
    put("obliques", (st) => <path key="ob" d={capsule(at(0.18, 1), at(0.55, 2), 5, 5)} style={st} />);
    put("abs", (st) => <path key="ab" d={capsule(at(0.15, 7.5), at(0.62, 8.5), 3.8, 3.8)} style={st} />);
    put("chest", (st) => <path key="ch" d={capsule(at(0.66, 8.5), at(0.92, 9.5), 5.5, 6)} style={st} />);
    put("traps", (st) => <path key="tr" d={capsule(add(pose.sh, n, -4), add(r.head, n, -5), 4.5, 3)} style={st} />);
  }
  if (part === "leg") {
    const d1 = unit(pose.hip, leg.joint);
    const d2 = unit(leg.joint, leg.end);
    const n = front(d1);
    // Hamstrings sit on the side the shin folds toward; straight legs default to the back of the body.
    const cross = d1[0] * d2[1] - d1[1] * d2[0];
    const ham = Math.abs(cross) > 0.08 ? Math.sign(cross) : dot(n, chestN) < 0 ? 1 : -1;
    put("quads", (st) => <path key="q" d={capsule(add(add(pose.hip, d1, 6), n, -4 * ham), add(add(leg.joint, d1, -5), n, -3 * ham), 5.5, 4)} style={st} />);
    put("hamstrings", (st) => <path key="h" d={capsule(add(add(pose.hip, d1, 8), n, 4 * ham), add(add(leg.joint, d1, -6), n, 3 * ham), 5, 3.8)} style={st} />);
    put("adductors", (st) => <path key="ad" d={capsule(add(pose.hip, d1, 6), add(pose.hip, d1, 22), 3, 2.5)} style={st} />);
    const nShin = front(d2);
    const footDir = unit(leg.end, footTip(leg.joint, leg.end));
    const calfSide = nShin[0] * footDir[0] + nShin[1] * footDir[1] > 0 ? -1 : 1;
    put("calves", (st) => <path key="c" d={capsule(add(add(leg.joint, d2, 6), nShin, 2.5 * calfSide), add(add(leg.joint, d2, 24), nShin, 1.5 * calfSide), 4.2, 2.6)} style={st} />);
  }
  if (part === "arm") {
    const d1 = unit(pose.sh, arm.joint);
    const d2 = unit(arm.joint, arm.end);
    const n = front(d1);
    // Biceps sit on the side the forearm folds toward; a straight arm defaults to the front.
    const crossA = d1[0] * d2[1] - d1[1] * d2[0];
    const fold = Math.abs(crossA) > 0.08 ? Math.sign(crossA) : dot(n, chestN) > 0 ? 1 : -1;
    put("shoulders", (st) => <circle key="s" cx={pose.sh[0]} cy={pose.sh[1]} r={7.8} style={st} />);
    put("biceps", (st) => <path key="b" d={capsule(add(add(pose.sh, d1, 7), n, 2.6 * fold), add(add(arm.joint, d1, -4), n, 2.2 * fold), 3.8, 3)} style={st} />);
    put("triceps", (st) => <path key="t" d={capsule(add(add(pose.sh, d1, 7), n, -2.6 * fold), add(add(arm.joint, d1, -3), n, -2.2 * fold), 3.8, 3)} style={st} />);
    put("forearms", (st) => <path key="f" d={capsule(add(arm.joint, d2, 3), add(arm.end, d2, -4), 4, 3)} style={st} />);
  }
  return <g style={{ mixBlendMode: "normal" }}>{shapes}</g>;
}

function Body({ r, fill, far, outline, working }: { r: Rig; fill: string; far: string; outline?: boolean; working?: Working }) {
  const { pose, arm, leg } = r;
  const arm2 = r.arm2 ?? { joint: shift(arm.joint), end: shift(arm.end) };
  const leg2 = r.leg2 ?? { joint: shift(leg.joint), end: shift(leg.end) };
  const hip2 = r.leg2 ? pose.hip : shift(pose.hip);
  const sh2 = r.arm2 ? pose.sh : shift(pose.sh);
  const style = outline ? { fill: "none", stroke: fill, strokeWidth: 1.2 } : { fill };
  const farStyle = outline ? { fill: "none", stroke: far, strokeWidth: 1 } : { fill: far };
  return (
    <g>
      {/* far side */}
      <path d={capsule(hip2, leg2.joint, 8.5, 6)} style={farStyle} />
      <path d={capsule(leg2.joint, leg2.end, 6, 4.2)} style={farStyle} />
      <path d={capsule(leg2.end, footTip(leg2.joint, leg2.end), 4.2, 3.2)} style={farStyle} />
      <path d={capsule(sh2, arm2.joint, 6, 4.6)} style={farStyle} />
      <path d={capsule(arm2.joint, arm2.end, 4.6, 3.5)} style={farStyle} />
      {/* torso, pelvis, neck, head */}
      <path d={capsule(pose.hip, pose.sh, 11, 13)} style={style} />
      <circle cx={pose.hip[0]} cy={pose.hip[1]} r={11} style={style} />
      <path d={capsule(pose.sh, r.head, 5, 4.5)} style={style} />
      <ellipse cx={r.head[0]} cy={r.head[1]} rx={10.5} ry={12} transform={`rotate(${r.headAngle} ${r.head[0]} ${r.head[1]})`} style={style} />
      {working && <MuscleOverlays r={r} w={working} part="torso" />}
      {/* near leg and arm */}
      <path d={capsule(pose.hip, leg.joint, 9.5, 6.5)} style={style} />
      <path d={capsule(leg.joint, leg.end, 6.5, 4.5)} style={style} />
      <path d={capsule(leg.end, footTip(leg.joint, leg.end), 4.5, 3.5)} style={style} />
      {working && <MuscleOverlays r={r} w={working} part="leg" />}
      <circle cx={pose.sh[0]} cy={pose.sh[1]} r={7.5} style={style} />
      <path d={capsule(pose.sh, arm.joint, 7, 5.2)} style={style} />
      <path d={capsule(arm.joint, arm.end, 5.2, 4)} style={style} />
      <circle cx={arm.end[0]} cy={arm.end[1]} r={4.6} style={style} />
      {working && <MuscleOverlays r={r} w={working} part="arm" />}
    </g>
  );
}

function Figure({ motion, phase, size, muscles }: { motion: Motion; phase: number; size: number; muscles?: { primary: MuscleId[]; secondary: MuscleId[] } }) {
  const id = useId().replace(/:/g, "");
  const r = rig(motion, phase);
  // Faint outline of the other end of the movement, to show the range of motion.
  const ghost = motion.hold ? null : rig(motion, phase < 0.5 ? 0.5 : 0);
  const onFloor = [r.leg.end, r.leg2?.end, r.arm.end, r.pose.hip].filter((p): p is P => !!p && p[1] > 180).map((p) => p[0]);
  const shadowX = onFloor.length ? (Math.min(...onFloor) + Math.max(...onFloor)) / 2 : r.pose.hip[0];
  const shadowW = onFloor.length ? Math.max(26, (Math.max(...onFloor) - Math.min(...onFloor)) / 2 + 22) : 30;

  return (
    <svg viewBox="0 0 240 210" width="100%" style={{ maxWidth: size, display: "block", margin: "0 auto" }} role="img" aria-label={`${motion.label} demonstration`}>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" style={{ stopColor: "var(--figure-hi)" }} />
          <stop offset="1" style={{ stopColor: "var(--figure)" }} />
        </linearGradient>
        <radialGradient id={`s${id}`}>
          <stop offset="0" style={{ stopColor: "var(--figure-shadow)", stopOpacity: 0.55 }} />
          <stop offset="1" style={{ stopColor: "var(--figure-shadow)", stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      <line x1="8" y1="203" x2="232" y2="203" className="fa-floor" />
      <ellipse cx={shadowX} cy={204} rx={shadowW} ry={5} fill={`url(#s${id})`} />
      {motion.props?.map((p, i) => <StaticProp key={i} prop={p} foot={r.leg.end} hip={r.pose.hip} />)}
      {ghost && (
        <g opacity={0.14}>
          <Body r={ghost} fill="var(--figure)" far="var(--figure-far)" outline />
        </g>
      )}
      <Body
        r={r}
        fill={`url(#g${id})`}
        far="var(--figure-far)"
        working={
          muscles
            ? {
                primary: new Set(muscles.primary),
                secondary: new Set(muscles.secondary),
                // Effort builds toward the hardest point of the rep and eases off; holds stay switched on.
                mirrored: motion.mirrored,
                a: motion.hold ? 0.8 + 0.1 * Math.sin(phase * Math.PI * 2) : 0.5 - 0.5 * Math.cos(phase * Math.PI * 2),
              }
            : undefined
        }
      />
      {motion.props?.map((p, i) => <AttachedProp key={i} prop={p} hand={r.arm.end} hip={r.pose.hip} />)}
    </svg>
  );
}

function StaticProp({ prop, foot, hip }: { prop: Prop; foot: P; hip: P }) {
  switch (prop.type) {
    case "bench":
      return (
        <g className="fa-prop">
          <rect x={prop.x} y={prop.y} width={prop.w} height={9} rx={3} />
          <rect x={prop.x + 8} y={prop.y + 9} width={6} height={203 - prop.y - 9} />
          <rect x={prop.x + prop.w - 14} y={prop.y + 9} width={6} height={203 - prop.y - 9} />
        </g>
      );
    case "seat":
      return (
        <g className="fa-prop">
          <rect x={prop.x} y={prop.y} width={prop.w} height={8} rx={3} />
          <rect x={prop.x + prop.w / 2 - 3} y={prop.y + 8} width={6} height={203 - prop.y - 8} />
        </g>
      );
    case "bar":
      return <line x1={prop.x1} y1={prop.y} x2={prop.x2} y2={prop.y} className="fa-prop-line" strokeWidth={5} />;
    case "box":
      return <rect x={prop.x} y={prop.y} width={prop.w} height={203 - prop.y} rx={4} className="fa-prop" />;
    case "wall":
      return <rect x={prop.x - 10} y={8} width={10} height={195} className="fa-prop" />;
    case "platform": {
      // Leg press foot plate: square to the line of the legs, just past the feet.
      const dx = foot[0] - hip[0];
      const dy = foot[1] - hip[1];
      const l = Math.hypot(dx, dy) || 1;
      const [ux, uy] = [dx / l, dy / l];
      const [cx, cy] = [foot[0] + ux * 9, foot[1] + uy * 9];
      return <line x1={cx - uy * 24} y1={cy + ux * 24} x2={cx + uy * 24} y2={cy - ux * 24} className="fa-prop-line" strokeWidth={6} />;
    }
    default:
      return null;
  }
}

function AttachedProp({ prop, hand, hip }: { prop: Prop; hand: P; hip: P }) {
  if (prop.type === "cable") return <line x1={prop.from[0]} y1={prop.from[1]} x2={hand[0]} y2={hand[1]} className="fa-cable" />;
  if (prop.type !== "dumbbell" && prop.type !== "barbell" && prop.type !== "kettlebell") return null;
  const [x, y] = prop.at === "hip" ? [hip[0], hip[1] - 14] : hand;
  if (prop.type === "barbell")
    return (
      <g className="fa-prop">
        <circle cx={x} cy={y} r={17} />
        <circle cx={x} cy={y} r={4} className="fa-hole" />
      </g>
    );
  if (prop.type === "kettlebell")
    return (
      <g className="fa-prop">
        <circle cx={x} cy={y + 12} r={10} />
        <path d={`M${x - 6} ${y + 4} Q${x} ${y - 6} ${x + 6} ${y + 4}`} className="fa-prop-line" strokeWidth={3} fill="none" />
      </g>
    );
  return (
    <g className="fa-prop">
      <rect x={x - 11} y={y - 7} width={6} height={14} rx={2} />
      <rect x={x + 5} y={y - 7} width={6} height={14} rx={2} />
      <rect x={x - 6} y={y - 2} width={12} height={4} />
    </g>
  );
}
