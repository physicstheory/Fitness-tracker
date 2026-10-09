import { useEffect, useRef, useState } from "react";
import { BONES, poseAt, solveLimb, type Motion, type P, type Prop } from "../lib/motions";

const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Plays a looping form demo for one movement. */
export function FormAnimation({ motion, playing = true, size = 260 }: { motion: Motion; playing?: boolean; size?: number }) {
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

  return <Figure motion={motion} phase={phase} size={size} />;
}

function Figure({ motion, phase, size }: { motion: Motion; phase: number; size: number }) {
  const pose = poseAt(motion, phase);
  const arm = solveLimb(pose.sh, pose.hand, BONES.upperArm, BONES.forearm, motion.elbow);
  const leg = solveLimb(pose.hip, pose.foot, BONES.thigh, BONES.shin, motion.knee);
  const arm2 = pose.hand2 ? solveLimb(pose.sh, pose.hand2, BONES.upperArm, BONES.forearm, motion.elbow) : null;
  const leg2 = pose.foot2 ? solveLimb(pose.hip, pose.foot2, BONES.thigh, BONES.shin, motion.knee2 ?? motion.knee) : null;

  // Head sits on the line of the torso, past the shoulders.
  const tx = pose.sh[0] - pose.hip[0];
  const ty = pose.sh[1] - pose.hip[1];
  const tl = Math.hypot(tx, ty) || 1;
  const head: P = [pose.sh[0] + (tx / tl) * 21, pose.sh[1] + (ty / tl) * 21];

  const footTip = (knee: P, ankle: P): P => {
    const sx = ankle[0] - knee[0];
    const sy = ankle[1] - knee[1];
    const l = Math.hypot(sx, sy) || 1;
    // Rotate the shin direction 90° toward the front to get the foot.
    return [ankle[0] + (sy / l) * 13, ankle[1] - (sx / l) * 13];
  };

  const farOffset = (p: P): P => [p[0] - 3, p[1] - 2];
  const line = (a: P, b: P, w: number, key: string, cls = "fa-body") => <line key={key} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} strokeWidth={w} className={cls} />;

  const limbsFar = [
    // Far leg and arm sit slightly behind the near ones.
    ...(leg2
      ? [line(pose.hip, leg2.joint, 16, "ft"), line(leg2.joint, leg2.end, 12, "fs"), line(leg2.end, footTip(leg2.joint, leg2.end), 8, "ff")]
      : [line(farOffset(pose.hip), farOffset(leg.joint), 16, "ft"), line(farOffset(leg.joint), farOffset(leg.end), 12, "fs"), line(farOffset(leg.end), farOffset(footTip(leg.joint, leg.end)), 8, "ff")]),
    ...(arm2
      ? [line(pose.sh, arm2.joint, 11, "fu"), line(arm2.joint, arm2.end, 9, "fl")]
      : [line(farOffset(pose.sh), farOffset(arm.joint), 11, "fu"), line(farOffset(arm.joint), farOffset(arm.end), 9, "fl")]),
  ];

  return (
    <svg viewBox="0 0 240 210" width="100%" style={{ maxWidth: size, display: "block", margin: "0 auto" }} role="img" aria-label={`${motion.label} demonstration`}>
      <line x1="8" y1="203" x2="232" y2="203" className="fa-floor" />
      {motion.props?.map((p, i) => <StaticProp key={i} prop={p} foot={leg.end} hip={pose.hip} />)}
      <g className="fa-far">{limbsFar}</g>
      {line(pose.hip, leg.joint, 17, "t")}
      {line(leg.joint, leg.end, 13, "s")}
      {line(leg.end, footTip(leg.joint, leg.end), 9, "f")}
      {line(pose.hip, pose.sh, 25, "torso")}
      {line(pose.sh, head, 9, "neck")}
      <circle cx={head[0]} cy={head[1]} r={12.5} className="fa-fill" />
      {line(pose.sh, arm.joint, 12, "u")}
      {line(arm.joint, arm.end, 10, "l")}
      <circle cx={arm.end[0]} cy={arm.end[1]} r={5} className="fa-fill" />
      {motion.props?.map((p, i) => <AttachedProp key={i} prop={p} hand={arm.end} hip={pose.hip} />)}
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
