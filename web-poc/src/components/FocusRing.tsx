import { type ReactNode, useId } from "react";

interface Props {
  /** 0–100, or null for "no score yet" (a dashed track). */
  score: number | null;
  /** Outer size in px; the stroke scales with it. */
  size: number;
  /** Stroke width in the ring's own 0–200 coordinate space. */
  stroke?: number;
  children?: ReactNode;
  className?: string;
}

const R = 80;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** The Focus Score ring: a blue-to-teal arc on a quiet track, with whatever is passed as its centre. */
export function FocusRing({ score, size, stroke = 16, children, className = "" }: Props) {
  const gradient = useId();
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" aria-hidden className="size-full">
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: "var(--ring-from)" }} />
            <stop offset="1" style={{ stopColor: "var(--ring-to)" }} />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r={R} fill="none" stroke="var(--track)" strokeWidth={stroke} strokeDasharray={score === null ? "6 10" : undefined} />
        {score !== null && (
          <circle
            cx="100"
            cy="100"
            r={R}
            fill="none"
            stroke={`url(#${gradient})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            transform="rotate(-90 100 100)"
            strokeDasharray={`${(CIRCUMFERENCE * Math.min(100, Math.max(0, score))) / 100} ${CIRCUMFERENCE}`}
            style={{ transition: "stroke-dasharray var(--duration-dial) var(--ease-settle)" }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
