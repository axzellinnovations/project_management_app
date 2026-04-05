'use client';

import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export interface BurndownPoint {
  date: string;
  remainingPoints: number;
  idealPoints: number;
}

interface BurndownChartProps {
  sprintName: string;
  dataPoints: BurndownPoint[];
  totalStoryPoints: number;
}

const PAD = { top: 32, right: 24, bottom: 56, left: 56 };
const BLUE = '#175CD3';
const BLUE_LIGHT = '#EFF8FF';
const GREY = '#98A2B3';
const GREY_DASHED = '#D0D5DD';

function formatLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function BurndownChart({ sprintName, dataPoints, totalStoryPoints }: BurndownChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: BurndownPoint } | null>(null);
  const [actualPathLen, setActualPathLen] = useState<number | null>(null);
  const [idealPathLen, setIdealPathLen] = useState<number | null>(null);
  const actualRef = useRef<SVGPathElement | null>(null);
  const idealRef = useRef<SVGPathElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width || 700);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Measure path lengths for animation after render
  useEffect(() => {
    if (actualRef.current) setActualPathLen(actualRef.current.getTotalLength());
    if (idealRef.current)  setIdealPathLen(idealRef.current.getTotalLength());
  }, []);

  if (!dataPoints.length) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl bg-[#F8F9FB] text-[#98A2B3] text-sm">
        No data available for this sprint.
      </div>
    );
  }

  const height = Math.min(380, Math.max(240, width * 0.4));
  const innerW = width  - PAD.left - PAD.right;
  const innerH = height - PAD.top  - PAD.bottom;

  const n = dataPoints.length;
  const maxY = Math.max(totalStoryPoints, 1);

  const xScale = (i: number) => PAD.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yScale = (v: number) => PAD.top + innerH - (v / maxY) * innerH;

  const toPath = (pts: BurndownPoint[], getValue: (p: BurndownPoint) => number) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(getValue(p)).toFixed(1)}`).join(' ');

  const actualPath = toPath(dataPoints, (p) => p.remainingPoints);
  const idealPath  = toPath(dataPoints, (p) => p.idealPoints);

  // Y-axis ticks
  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((maxY / 4) * i));

  // X-axis ticks: show at most 8 labels, evenly spaced
  const xTickStep = Math.max(1, Math.ceil(n / 8));
  const xTicks = dataPoints.filter((_, i) => i % xTickStep === 0 || i === n - 1);

  return (
    <div ref={containerRef} className="w-full select-none">
      {/* Legend */}
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="text-[15px] font-semibold text-[#101828]">{sprintName}</h3>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5">
            <svg width="24" height="4">
              <line x1="0" y1="2" x2="24" y2="2" stroke={BLUE} strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span className="text-[12px] text-[#475467]">Actual</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="24" height="4">
              <line x1="0" y1="2" x2="24" y2="2" stroke={GREY_DASHED} strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" />
            </svg>
            <span className="text-[12px] text-[#475467]">Ideal</span>
          </div>
        </div>
      </div>

      <div className="relative">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Background */}
          <rect x={PAD.left} y={PAD.top} width={innerW} height={innerH}
            rx="6" fill={BLUE_LIGHT} fillOpacity="0.25" />

          {/* Y grid lines */}
          {yTicks.map((tick) => {
            const y = yScale(tick);
            return (
              <g key={tick}>
                <line x1={PAD.left} y1={y} x2={PAD.left + innerW} y2={y}
                  stroke={GREY_DASHED} strokeWidth="1" strokeDasharray={tick === 0 ? '0' : '4 3'} />
                <text x={PAD.left - 8} y={y + 4} textAnchor="end"
                  fontSize="11" fill={GREY} fontFamily="Inter, system-ui, sans-serif">
                  {tick}
                </text>
              </g>
            );
          })}

          {/* X axis line */}
          <line x1={PAD.left} y1={PAD.top + innerH} x2={PAD.left + innerW} y2={PAD.top + innerH}
            stroke={GREY_DASHED} strokeWidth="1" />

          {/* X axis ticks */}
          {xTicks.map((p) => {
            const idx = dataPoints.indexOf(p);
            const x = xScale(idx);
            return (
              <g key={p.date}>
                <line x1={x} y1={PAD.top + innerH} x2={x} y2={PAD.top + innerH + 5}
                  stroke={GREY} strokeWidth="1" />
                <text x={x} y={PAD.top + innerH + 18} textAnchor="middle"
                  fontSize="11" fill={GREY} fontFamily="Inter, system-ui, sans-serif">
                  {formatLabel(p.date)}
                </text>
              </g>
            );
          })}

          {/* Axis labels */}
          <text
            x={PAD.left - 40}
            y={PAD.top + innerH / 2}
            textAnchor="middle"
            fontSize="11"
            fill={GREY}
            fontFamily="Inter, system-ui, sans-serif"
            transform={`rotate(-90, ${PAD.left - 40}, ${PAD.top + innerH / 2})`}
          >Story Points</text>
          <text
            x={PAD.left + innerW / 2}
            y={height - 6}
            textAnchor="middle"
            fontSize="11"
            fill={GREY}
            fontFamily="Inter, system-ui, sans-serif"
          >Sprint Days</text>

          {/* Ideal line (dashed, grey) — drawn first so actual sits on top */}
          <path
            ref={idealRef}
            d={idealPath}
            fill="none"
            stroke={GREY_DASHED}
            strokeWidth="2"
            strokeDasharray="6 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {idealPathLen != null && (
            <motion.path
              d={idealPath}
              fill="none"
              stroke={GREY_DASHED}
              strokeWidth="2"
              strokeDasharray={`${idealPathLen} ${idealPathLen}`}
              strokeDashoffset={idealPathLen}
              strokeLinecap="round"
              strokeLinejoin="round"
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 1.0, ease: 'easeInOut' }}
            />
          )}

          {/* Area fill under actual line */}
          {n > 1 && (
            <path
              d={`${actualPath} L${xScale(n - 1).toFixed(1)},${(PAD.top + innerH).toFixed(1)} L${xScale(0).toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`}
              fill={BLUE}
              fillOpacity="0.07"
            />
          )}

          {/* Actual line (solid, blue) — hidden clone just to measure length */}
          <path
            ref={actualRef}
            d={actualPath}
            fill="none"
            stroke="transparent"
            strokeWidth="0"
          />
          {actualPathLen != null && (
            <motion.path
              d={actualPath}
              fill="none"
              stroke={BLUE}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${actualPathLen} ${actualPathLen}`}
              strokeDashoffset={actualPathLen}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 1.2, ease: 'easeInOut', delay: 0.15 }}
            />
          )}

          {/* Hover targets & dots */}
          {dataPoints.map((p, i) => {
            const cx = xScale(i);
            const cy = yScale(p.remainingPoints);
            return (
              <g key={p.date}>
                {/* Invisible wider hit area */}
                <rect
                  x={cx - (innerW / n / 2)}
                  y={PAD.top}
                  width={innerW / n}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setTooltip({ x: cx, y: cy, point: p })}
                />
                {tooltip?.point.date === p.date && (
                  <>
                    <line x1={cx} y1={PAD.top} x2={cx} y2={PAD.top + innerH}
                      stroke={BLUE} strokeWidth="1" strokeDasharray="3 2" strokeOpacity="0.4" />
                    <circle cx={cx} cy={cy} r={5} fill={BLUE} stroke="white" strokeWidth="2" />
                    <circle cx={xScale(i)} cy={yScale(p.idealPoints)} r={4}
                      fill={GREY_DASHED} stroke="white" strokeWidth="2" />
                  </>
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {tooltip && (() => {
          const svgLeft = 0;
          const tw = 148;
          const th = 72;
          let tx = tooltip.x - tw / 2;
          if (tx < svgLeft + 4) tx = svgLeft + 4;
          if (tx + tw > width - 4) tx = width - tw - 4;
          const ty = tooltip.y - th - 10;
          return (
            <div
              className="pointer-events-none absolute rounded-lg border border-[#E4E7EC] bg-white px-3 py-2.5 shadow-lg"
              style={{ left: tx, top: Math.max(4, ty), width: tw }}
            >
              <p className="mb-1.5 text-[11px] font-semibold text-[#667085]">{formatLabel(tooltip.point.date)}</p>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#344054]">Remaining</span>
                <span className="font-bold text-[#175CD3]">{tooltip.point.remainingPoints} pts</span>
              </div>
              <div className="mt-0.5 flex items-center justify-between text-[12px]">
                <span className="text-[#98A2B3]">Ideal</span>
                <span className="font-medium text-[#98A2B3]">{tooltip.point.idealPoints} pts</span>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
