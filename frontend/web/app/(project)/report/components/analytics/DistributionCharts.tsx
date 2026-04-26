'use client';
// ══════════════════════════════════════════════════════════════════════════════
//  DistributionCharts.tsx  ·  Status donut + Priority bar — Recharts
// ══════════════════════════════════════════════════════════════════════════════
import React from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { ReportData } from '@/lib/report/reportUtils';
import { STATUS_COLORS, PRIORITY_COLORS } from '@/lib/report/reportUtils';

const STATUS_LABELS: Record<string, string> = {
  TODO: 'To Do', IN_PROGRESS: 'In Progress', IN_REVIEW: 'In Review', DONE: 'Done',
};
const PRIORITY_ORDER = ['URGENT', 'HIGH', 'MEDIUM', 'NORMAL', 'LOW', 'UNASSIGNED'];

// ── Custom tooltip ─────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs font-semibold shadow-lg"
      style={{ background: 'rgba(255,255,255,0.95)', border: `2px solid ${d.color}`, color: '#1F2937' }}
    >
      {d.label}: <span style={{ color: d.color }}>{d.value}</span> tasks ({d.pct}%)
    </div>
  );
}

// ── Glass card wrapper ─────────────────────────────────────────────────────────
function ChartCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div
      className="flex-1 min-w-[280px] rounded-2xl p-5"
      style={{
        background:     'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(20px) saturate(180%)',
        border:         '1px solid rgba(255,255,255,0.65)',
        boxShadow:      '0 4px 24px rgba(0,0,0,0.06)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">{title}</p>
        {sub && <span className="text-[10px] text-[#B0B8C4]">{sub}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Status donut ───────────────────────────────────────────────────────────────
interface StatusChartProps {
  data: ReportData;
  activeStatus: string;
  onFilter: (key: string) => void;
}

export function StatusChart({ data, activeStatus, onFilter }: StatusChartProps) {
  const chartData = data.statusDist.map(d => ({
    key:   d.name,
    label: STATUS_LABELS[d.name] ?? d.name,
    value: d.count,
    pct:   d.pct,
    color: STATUS_COLORS[d.name] ?? '#9CA3AF',
  }));

  const total = data.tasks.length;

  return (
    <ChartCard title="Status Distribution" sub={`${total} tasks`}>
      <div className="flex items-center gap-4">
        {/* Donut */}
        <div style={{ width: 140, height: 140, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%" cy="50%"
                innerRadius={42} outerRadius={64}
                paddingAngle={3}
                dataKey="value"
                onClick={d => { const k = String(d.key ?? ''); onFilter(activeStatus === k ? '' : k); }}
                style={{ cursor: 'pointer' }}
              >
                {chartData.map(entry => (
                  <Cell
                    key={entry.key}
                    fill={entry.color}
                    opacity={!activeStatus || activeStatus === entry.key ? 1 : 0.3}
                    stroke={activeStatus === entry.key ? '#1A1A2E' : 'none'}
                    strokeWidth={activeStatus === entry.key ? 2 : 0}
                  />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-2 flex-1">
          {chartData.map(d => (
            <button
              key={d.key}
              onClick={() => onFilter(activeStatus === d.key ? '' : d.key)}
              className="flex items-center gap-2 text-left hover:bg-[#F8FAFF] rounded-lg px-2 py-1 transition-colors w-full"
              style={{ opacity: !activeStatus || activeStatus === d.key ? 1 : 0.45 }}
            >
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
              <span className="text-[11px] font-semibold text-[#374151] flex-1">{d.label}</span>
              <span className="text-[11px] font-black" style={{ color: d.color }}>{d.value}</span>
              <span className="text-[10px] text-[#9CA3AF] w-8 text-right">{d.pct}%</span>
            </button>
          ))}
          {activeStatus && (
            <button
              onClick={() => onFilter('')}
              className="text-[10px] font-semibold text-[#155DFC] hover:underline text-left px-2"
            >
              × Clear filter
            </button>
          )}
        </div>
      </div>
    </ChartCard>
  );
}

// ── Priority bar chart ─────────────────────────────────────────────────────────
interface PriorityChartProps {
  data: ReportData;
  activePriority: string;
  onFilter: (key: string) => void;
}

export function PriorityChart({ data, activePriority, onFilter }: PriorityChartProps) {
  const sorted = [...data.priorityDist].sort(
    (a, b) => PRIORITY_ORDER.indexOf(a.name) - PRIORITY_ORDER.indexOf(b.name),
  );

  const chartData = sorted.map(d => ({
    key:   d.name,
    name:  d.name.charAt(0) + d.name.slice(1).toLowerCase(),
    value: d.count,
    pct:   d.pct,
    color: PRIORITY_COLORS[d.name] ?? '#6B7280',
  }));

  const maxVal = Math.max(...chartData.map(d => d.value), 1);

  return (
    <ChartCard title="Priority Breakdown" sub={`${data.tasks.length} tasks`}>
      {chartData.length === 0 ? (
        <p className="text-[11px] text-[#9CA3AF] text-center py-8">No data</p>
      ) : (
        <div className="flex flex-col gap-2">
          {chartData.map(d => (
            <button
              key={d.key}
              onClick={() => onFilter(activePriority === d.key ? '' : d.key)}
              className="flex items-center gap-2 hover:bg-[#F8FAFF] rounded-lg px-2 py-1.5 transition-colors w-full text-left"
              style={{ opacity: !activePriority || activePriority === d.key ? 1 : 0.35 }}
            >
              {/* Label */}
              <span className="text-[11px] font-semibold text-[#374151] w-16 shrink-0">
                {d.name}
              </span>
              {/* Bar */}
              <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width:      `${(d.value / maxVal) * 100}%`,
                    background: d.color,
                    opacity:    !activePriority || activePriority === d.key ? 1 : 0.4,
                  }}
                />
              </div>
              {/* Count + pct */}
              <span className="text-[11px] font-black w-6 text-right" style={{ color: d.color }}>{d.value}</span>
              <span className="text-[10px] text-[#9CA3AF] w-8 text-right">{d.pct}%</span>
            </button>
          ))}
          {activePriority && (
            <button
              onClick={() => onFilter('')}
              className="text-[10px] font-semibold text-[#155DFC] hover:underline text-left px-2"
            >
              × Clear filter
            </button>
          )}
        </div>
      )}
    </ChartCard>
  );
}
