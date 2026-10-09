import type { ReactNode } from "react";
import { MUSCLE_NAMES, type MuscleId } from "../lib/muscles";

// Left half of the body (viewer's left); the right half is mirrored. viewBox 0 0 220 440, centre line x = 110.
const SILHOUETTE =
  "M110 54 L102 54 L101 66 Q86 70 70 76 Q54 80 50 94 Q46 104 46 118 Q44 140 42 158 Q38 182 38 204 Q37 216 40 226 Q44 236 50 232 Q54 222 52 208 Q56 184 58 162 Q60 146 62 134 L66 120 Q70 140 72 160 Q74 180 74 196 Q72 206 74 214 Q70 250 74 290 Q74 300 76 312 Q72 340 76 372 Q78 392 78 402 Q70 414 76 420 L98 420 Q100 410 98 400 Q102 372 102 344 Q104 324 102 312 Q106 300 106 290 Q108 250 108 222 L110 218 Z";

type Shape = { m: MuscleId; d: string };

const FRONT: Shape[] = [
  { m: "traps", d: "M101 64 Q88 70 74 76 Q86 80 100 76 Z" },
  { m: "shoulders", d: "M72 78 Q56 80 51 96 Q50 110 54 118 Q60 104 68 98 Q74 90 78 84 Z" },
  { m: "chest", d: "M80 84 Q96 80 108 84 L108 118 Q96 124 82 120 Q72 114 70 104 Q72 92 80 84 Z" },
  { m: "biceps", d: "M54 120 Q50 132 49 148 Q53 156 58 152 Q62 140 63 126 Q60 118 54 120 Z" },
  { m: "forearms", d: "M47 162 Q42 182 41 202 Q45 206 49 204 Q55 184 58 164 Q52 158 47 162 Z" },
  { m: "abs", d: "M97 124 Q97 122 99 122 L108 122 L108 138 L99 138 Q97 138 97 136 Z" },
  { m: "abs", d: "M97 142 Q97 140 99 140 L108 140 L108 156 L99 156 Q97 156 97 154 Z" },
  { m: "abs", d: "M97 160 Q97 158 99 158 L108 158 L108 174 L99 174 Q97 174 97 172 Z" },
  { m: "abs", d: "M97 177 L108 177 L108 202 Q101 200 98 191 Z" },
  { m: "obliques", d: "M84 124 Q93 128 95 132 L95 190 Q88 194 82 186 Q78 166 78 146 Q78 130 84 124 Z" },
  { m: "hip_flexors", d: "M84 200 Q95 202 104 212 Q100 220 94 218 Q87 210 84 200 Z" },
  { m: "quads", d: "M76 220 Q72 252 76 286 Q82 300 88 298 Q86 260 88 226 Q82 216 76 220 Z" },
  { m: "quads", d: "M90 222 Q98 220 101 230 Q103 262 98 290 Q92 298 89 290 Q88 256 90 222 Z" },
  { m: "quads", d: "M100 268 Q106 280 104 300 Q98 306 93 300 Q98 288 100 268 Z" },
  { m: "adductors", d: "M104 222 Q108 238 107 262 Q103 252 101 236 Q101 226 104 222 Z" },
  { m: "calves", d: "M78 322 Q74 346 78 372 Q84 380 88 372 Q88 346 86 324 Q82 318 78 322 Z" },
  { m: "calves", d: "M92 324 Q100 340 99 368 Q95 376 92 368 Q90 346 92 324 Z" },
];

const BACK: Shape[] = [
  { m: "traps", d: "M110 56 L102 58 Q100 68 76 77 Q92 84 102 96 Q106 110 110 128 Z" },
  { m: "shoulders", d: "M72 78 Q56 80 51 96 Q50 110 54 118 Q62 102 70 96 Q78 88 76 80 Z" },
  { m: "triceps", d: "M53 120 Q48 136 48 150 Q52 158 58 154 Q63 140 64 124 Q59 117 53 120 Z" },
  { m: "forearms", d: "M47 162 Q42 182 41 202 Q45 206 49 204 Q55 184 58 164 Q52 158 47 162 Z" },
  { m: "upper_back", d: "M80 86 Q92 90 99 100 Q100 112 93 116 Q83 110 74 104 Q73 94 80 86 Z" },
  { m: "lats", d: "M70 108 Q84 114 96 122 Q102 146 103 168 Q96 176 86 178 Q78 160 74 140 Q70 124 70 108 Z" },
  { m: "lower_back", d: "M100 150 Q106 152 108 156 L108 196 Q102 198 96 192 Q96 170 100 150 Z" },
  { m: "glutes", d: "M78 202 Q92 196 108 204 L108 236 Q96 248 82 242 Q74 230 76 214 Q76 206 78 202 Z" },
  { m: "hamstrings", d: "M78 250 Q74 272 78 298 Q84 304 90 300 Q90 272 90 252 Q84 246 78 250 Z" },
  { m: "hamstrings", d: "M94 252 Q102 248 106 256 Q106 280 100 302 Q94 306 92 298 Q92 272 94 252 Z" },
  { m: "calves", d: "M78 318 Q72 336 78 360 Q84 368 90 360 Q90 336 88 318 Q82 312 78 318 Z" },
  { m: "calves", d: "M92 318 Q100 314 102 324 Q104 344 98 362 Q94 368 92 360 Q90 338 92 318 Z" },
];

function Body({ shapes, primary, secondary, label }: { shapes: Shape[]; primary: Set<MuscleId>; secondary: Set<MuscleId>; label: string }) {
  const half = (key: string) =>
    shapes.map((s, i) => {
      const cls = primary.has(s.m) ? "mm-primary" : secondary.has(s.m) ? "mm-secondary" : "mm-muscle";
      return <path key={`${key}${i}`} d={s.d} className={cls} style={{ animationDelay: `${(i % 6) * 0.08}s` }} />;
    });
  return (
    <figure className="mm-figure">
      <svg viewBox="0 0 220 440" role="img" aria-label={`${label} view`}>
        <ellipse cx="110" cy="32" rx="18" ry="22" className="mm-sil" />
        <path d={SILHOUETTE} className="mm-sil" />
        <path d={SILHOUETTE} className="mm-sil" transform="translate(220 0) scale(-1 1)" />
        {half("l")}
        <g transform="translate(220 0) scale(-1 1)">{half("r")}</g>
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

/** Front and back body silhouettes; worked muscles glow orange and pulse (contract / relax). */
export function MuscleMap({ primary, secondary, children }: { primary: MuscleId[]; secondary: MuscleId[]; children?: ReactNode }) {
  const p = new Set(primary);
  const s = new Set(secondary);
  return (
    <div className="mm">
      <div className="mm-bodies">
        <Body shapes={FRONT} primary={p} secondary={s} label="Front" />
        <Body shapes={BACK} primary={p} secondary={s} label="Back" />
      </div>
      {(primary.length > 0 || secondary.length > 0) && (
        <div className="chips" style={{ justifyContent: "center" }}>
          {primary.map((m) => (
            <span key={m} className="chip mm-chip-primary">
              {MUSCLE_NAMES[m]}
            </span>
          ))}
          {secondary.map((m) => (
            <span key={m} className="chip mm-chip-secondary">
              {MUSCLE_NAMES[m]}
            </span>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}
