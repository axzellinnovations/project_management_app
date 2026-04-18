'use client';
// ══════════════════════════════════════════════════════════════════════════════
//  SprintChart.tsx  ·  Sprint velocity + completion rates — Recharts
// ══════════════════════════════════════════════════════════════════════════════
import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import type { ReportData, SprintStat } from '@/lib/report/reportUtils';

function getSprintColor(status: string): string {
  switch (status) {
    case 'Active':    return '#155DFC';
    case 'Completed': return '#16A34A';
    default:          return '#9CA3AF';
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SprintTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d: SprintStat = payload[0].payload._raw;
  return (
    <div
      className="rounded-xl p-3 shadow-xl text-xs"
      style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid #E5E7EB', minWidth: 160 }}
    >
      <p className="font-bold text-[#1F2937] mb-2">{d.name}</p>
      <div className="flex flex-col gap-1">
        <div className="flex justify-between gap-4">
          <span className="text-[#9CA3AF]">Status</span>
          <span className="font-bold" style={{ color: getSprintColor(d.status) }}>{d.status}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#9CA3AF]">Tasks</span>
          <span className="font-bold text-[#1F2937]">{d.completedTasks}/{d.totalTasks}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#9CA3AF]">Velocity</span>
          <span className="font-bold text-[#7C3AED]">{d.completedPoints} pts</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#9CA3AF]">Completion</span>
          <span className="font-bold" style={{ color: getSprintColor(d.status) }}>{d.completionRate}%</span>
        </div>
      </div>
    </div>
  );
}

interface Props { data: ReportData }

export default function SprintChart({ data }: Props) {
  const { sprintStats, avgVelocity } = data;

  if (!sprintStats.length) {
    return (
      <div
        className="rounded-2xl p-5 flex items-center justify-center"
        style={{
          background:     'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(20px)',
          border:         '1px solid rgba(255,255,255,0.65)',
          boxShadow:      '0 4px 24px rgba(0,0,0,0.06)',
          minHeight:      200,
        }}
      >
        <p className="text-[12px] text-[#9CA3AF]">No sprint data available</p>
      </div>
    );
  }

  const chartData = sprintStats.map(s => ({
    name:           s.name.replace(/sprint\s*/i, 'S').trim(),
    completionRate: s.completionRate,
    velocity:       s.completedPoints,
    color:          getSprintColor(s.status),
    _raw:           s,
  }));

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background:     'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(20px) saturate(180%)',
        border:         '1px solid rgba(255,255,255,0.65)',
        boxShadow:      '0 4px 24px rgba(0,0,0,0.06)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">
          Sprint Completion Rates
        </p>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#EBF2FF', color: '#155DFC' }}>
          Avg velocity: {avgVelocity} pts
        </span>
      </div>
      <p className="text-[10px] text-[#B0B8C4] mb-4">{sprintStats.length} sprint{sprintStats.length > 1 ? 's' : ''} · click bar for details</p>

      {/* Completion rate chart */}
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 10, right: 8, left: -12, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
          <YAxis
            domain={[0, 100]}
            tickFormatter={v => `${v}%`}
            tick={{ fontSize: 9, fill: '#9CA3AF' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<SprintTooltip />} cursor={{ fill: 'rgba(21,93,252,0.04)' }} />
          {/* 70% reference line */}
          <ReferenceLine y={70} stroke="#16A34A" strokeDasharray="4 3" strokeWidth={1} />
          <Bar dataKey="completionRate" radius={[4, 4, 0, 0]} maxBarSize={28}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3">
        {[
          { color: '#16A34A', label: 'Completed' },
          { color: '#155DFC', label: 'Active' },
          { color: '#9CA3AF', label: 'Planned' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
            <span className="text-[10px] text-[#6B7280]">{l.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0 border-t border-dashed border-[#16A34A]" />
          <span className="text-[10px] text-[#6B7280]">70% target</span>
        </div>
      </div>

      {/* Sprint detail rows */}
      <div className="mt-4 space-y-1.5">
        {sprintStats.map((s, i) => (
          <div key={i} className="flex items-center gap-3 py-1.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: getSprintColor(s.status) }} />
            <span className="text-[11px] font-semibold text-[#374151] flex-1 truncate">{s.name}</span>
            <span className="text-[10px] text-[#9CA3AF]">{s.completedTasks}/{s.totalTasks} tasks</span>
            <span
              className="text-[10px] font-black px-2 py-0.5 rounded-full shrink-0"
              style={{
                background: `${getSprintColor(s.status)}18`,
                color:      getSprintColor(s.status),
              }}
            >
              {s.completionRate}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
