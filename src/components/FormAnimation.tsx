import { useEffect, useId, useRef, useState } from "react";
import { BONES, poseAt, solveLimb, type Motion, type P, type Pose, type Prop } from "../lib/motions";

const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Plays a looping form demo for one movement, with the current phase ("Lower", "Press") underneath. */
export function FormAnimation({ motion, playing = true, size = 260, showPhase = true }: { motion: Motion; playing?: boolean; size?: number; showPhase?: boolean }) {
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
      <Figure motion={motion} phase={phase} size={size} />
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

function Body({ r, fill, far, outline }: { r: Rig; fill: string; far: string; outline?: boolean }) {
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
      {/* near leg and arm */}
      <path d={capsule(pose.hip, leg.joint, 9.5, 6.5)} style={style} />
      <path d={capsule(leg.joint, leg.end, 6.5, 4.5)} style={style} />
      <path d={capsule(leg.end, footTip(leg.joint, leg.end), 4.5, 3.5)} style={style} />
      <circle cx={pose.sh[0]} cy={pose.sh[1]} r={7.5} style={style} />
      <path d={capsule(pose.sh, arm.joint, 7, 5.2)} style={style} />
      <path d={capsule(arm.joint, arm.end, 5.2, 4)} style={style} />
      <circle cx={arm.end[0]} cy={arm.end[1]} r={4.6} style={style} />
    </g>
  );
}

function Figure({ motion, phase, size }: { motion: Motion; phase: number; size: number }) {
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
      <Body r={r} fill={`url(#g${id})`} far="var(--figure-far)" />
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
