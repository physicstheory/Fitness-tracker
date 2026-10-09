import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, Sparkles, X } from "lucide-react";
import { useNav } from "../nav";

export function ProgressRing({
  value,
  size = 120,
  stroke = 10,
  color = "url(#ring-grad)",
  track = "var(--card-2)",
  children,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff5a36" />
            <stop offset="100%" stopColor="#ff9f1c" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: "stroke-dashoffset 0.35s linear" }}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

export function Overlay({
  title,
  right,
  children,
  onClose,
}: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  onClose?: () => void;
}) {
  const nav = useNav();
  return (
    <div className="overlay">
      <div className="overlay-inner">
        <div className="topbar">
          <button className="icon-btn" onClick={onClose ?? nav.pop} aria-label="Back">
            <ChevronLeft size={22} />
          </button>
          <h2 className="ellipsis">{title}</h2>
          {right}
        </div>
        <div className="overlay-body">{children}</div>
      </div>
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="grabber" />
        {title && (
          <div className="row between" style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 20 }}>{title}</h3>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function Switch({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button className="toggle" style={{ width: "100%", textAlign: "left" }} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span className="col" style={{ gap: 2 }}>
        <span style={{ fontWeight: 650 }}>{label}</span>
        {hint && <span className="small muted">{hint}</span>}
      </span>
      <span className={`switch ${on ? "on" : ""}`} />
    </button>
  );
}

export function AIBadge({ label = "AI" }: { label?: string }) {
  return (
    <span className="ai-badge">
      <Sparkles size={11} /> {label}
    </span>
  );
}

export function AILoading({ messages }: { messages: string[] }) {
  return (
    <div className="ai-loading">
      <div className="orb" />
      <RotatingText messages={messages} />
    </div>
  );
}

function RotatingText({ messages }: { messages: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % messages.length), 2600);
    return () => clearInterval(t);
  }, [messages.length]);
  return (
    <p key={i} className="muted" style={{ fontWeight: 600, animation: "fadeUp .3s ease" }}>
      {messages[i]}
    </p>
  );
}

export function BarChart({
  data,
  height = 140,
  highlightLast = true,
  target,
}: {
  data: { label: string; value: number }[];
  height?: number;
  highlightLast?: boolean;
  target?: number;
}) {
  const max = Math.max(1, target ?? 0, ...data.map((d) => d.value));
  const w = 100 / data.length;
  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" width="100%" height={height} style={{ display: "block" }}>
        {target ? (
          <line
            x1="0"
            x2="100"
            y1={height - (target / max) * (height - 16)}
            y2={height - (target / max) * (height - 16)}
            stroke="var(--faint)"
            strokeDasharray="1.5 1.5"
            strokeWidth="0.4"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {data.map((d, i) => {
          const h = d.value ? Math.max(3, (d.value / max) * (height - 16)) : 2;
          return (
            <rect
              key={i}
              x={i * w + w * 0.18}
              y={height - h}
              width={w * 0.64}
              height={h}
              rx={1.2}
              fill={d.value ? (highlightLast && i === data.length - 1 ? "#ff9f1c" : "#ff5a36") : "var(--card-2)"}
              opacity={d.value ? 1 : 0.8}
            >
              <title>{`${d.label}: ${d.value}`}</title>
            </rect>
          );
        })}
      </svg>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${data.length}, 1fr)`, marginTop: 6 }}>
        {data.map((d, i) => (
          <span key={i} className="faint num" style={{ fontSize: 10, textAlign: "center", fontWeight: 600 }}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Confetti({ show }: { show: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        dur: 2.2 + Math.random() * 1.6,
        color: ["#ff5a36", "#ff9f1c", "#2fb67c", "#1e9bff", "#7c5cff", "#e83f8b"][i % 6],
        rot: Math.random() * 360,
      })),
    [],
  );
  if (!show) return null;
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p, i) => (
        <i
          key={i}
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rot}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="emoji-badge" style={{ width: 56, height: 56, fontSize: 26 }}>
        {icon}
      </div>
      <p style={{ fontWeight: 700, color: "var(--text)" }}>{title}</p>
      {children}
    </div>
  );
}

export const setLabel = (target: number, type: "reps" | "time") =>
  target === 0 ? "MAX" : type === "time" ? `${target}s` : String(target);
