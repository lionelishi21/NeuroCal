"use client";

import { useEffect, useState } from "react";
import type { Macros } from "@neurocal/contracts";
import { kcal } from "../lib/format";

const KCAL_PER_TICK = 50;
const SIZE = 320;
const C = SIZE / 2;

interface Props {
  calorieTarget: number;
  caloriesEaten: number;
  macrosEaten: Macros;
  macroTargets: Macros;
}

function polar(r: number, turn: number) {
  const a = turn * 2 * Math.PI - Math.PI / 2;
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
}

function arcPath(r: number, fraction: number) {
  const f = Math.min(Math.max(fraction, 0), 0.9999);
  const start = polar(r, 0);
  const end = polar(r, f);
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${end.x} ${end.y}`;
}

/**
 * The day at a glance. Each outer tick is 50 kcal of today's budget; eaten ticks fill
 * with glucose, and anything over budget wraps round again in beet. The three inner
 * arcs are protein, carbs and fat against their targets.
 */
export function BioStateDial({ calorieTarget, caloriesEaten, macrosEaten, macroTargets }: Props) {
  // Ticks settle in once after mount; later changes transition from the current state.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const ticks = Math.round(calorieTarget / KCAL_PER_TICK);
  const eatenTicks = settled ? Math.round(caloriesEaten / KCAL_PER_TICK) : 0;
  const overTicks = Math.max(0, eatenTicks - ticks);
  const remaining = calorieTarget - caloriesEaten;
  const over = remaining < 0;

  const macros = [
    { key: "protein", r: 114, color: "var(--chlorophyll)", f: macrosEaten.proteinG / macroTargets.proteinG },
    { key: "carbs", r: 102, color: "var(--glucose)", f: macrosEaten.carbsG / macroTargets.carbsG },
    { key: "fat", r: 90, color: "var(--oil)", f: macrosEaten.fatG / macroTargets.fatG },
  ];

  const label = over
    ? `${kcal(-remaining)} kcal over today's ${kcal(calorieTarget)} kcal budget`
    : `${kcal(remaining)} kcal left of ${kcal(calorieTarget)} kcal today`;

  return (
    <figure className="m-0 w-full max-w-[20rem]">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={label} className="block w-full">
        {Array.from({ length: ticks }, (_, i) => {
          const turn = i / ticks;
          const eaten = i < eatenTicks;
          const isOver = i < overTicks;
          const inner = polar(eaten ? 130 : 136, turn);
          const outer = polar(152, turn);
          return (
            <line
              key={i}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              strokeLinecap="round"
              strokeWidth={eaten ? 5 : 3}
              style={{
                stroke: isOver ? "var(--beet)" : eaten ? "var(--glucose)" : "var(--rule)",
                transition: `stroke var(--duration-dial) var(--ease-settle), stroke-width var(--duration-dial) var(--ease-settle)`,
                transitionDelay: `calc(${i} * var(--duration-dial) / ${ticks * 1.5})`,
              }}
            />
          );
        })}

        {macros.map((m) => (
          <g key={m.key}>
            <circle cx={C} cy={C} r={m.r} fill="none" strokeWidth={6} style={{ stroke: "var(--rule)", opacity: 0.55 }} />
            <path
              d={arcPath(m.r, settled ? m.f : 0)}
              fill="none"
              strokeWidth={6}
              strokeLinecap="round"
              style={{ stroke: m.color }}
            />
          </g>
        ))}

        <text
          x={C}
          y={C + 8}
          textAnchor="middle"
          className="font-figure"
          style={{
            fill: over ? "var(--beet)" : "var(--ink)",
            fontSize: "var(--text-figure)",
            fontVariationSettings: '"opsz" 144, "SOFT" 100, "WONK" 0',
            fontWeight: 420,
          }}
        >
          {kcal(Math.abs(remaining))}
        </text>
        <text
          x={C}
          y={C + 36}
          textAnchor="middle"
          style={{ fill: "var(--ink-soft)", fontSize: "var(--text-sm)" }}
        >
          {over ? "kcal over" : "kcal left"}
        </text>
      </svg>
    </figure>
  );
}
