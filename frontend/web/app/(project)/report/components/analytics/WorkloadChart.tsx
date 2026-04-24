'use client';
// ══════════════════════════════════════════════════════════════════════════════
//  WorkloadChart.tsx  ·  Team workload grouped bar chart — Recharts
// ══════════════════════════════════════════════════════════════════════════════
import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import type { ReportData } from '@/lib/report/reportUtils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl p-3 shadow-xl text-xs"
      style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid #E5E7EB', minWidth: 140 }}
    >
      <p className="font-bold text-[#1F2937] mb-2">{label}</p>
      {payload.map((p: { name: string; value: number; fill: string }, i: number) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.fill }} />
          <span className="text-[#6B7280]">{p.name}:</span>
          <span className="font-bold text-[#1F2937]">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

interface Props {
  data: ReportData;
  onMemberFilter: (name: string) => void;
  activeMember: string;
}

export default function WorkloadChart({ data, onMemberFilter, activeMember }: Props) {
  const { memberStats } = data;

  if (memberStats.length === 0) {
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
        <p className="text-[12px] text-[#9CA3AF]">No team data available</p>
      </div>
    );
  }

  const chartData = memberStats.map(m => ({
    name:      m.name.split(' ')[0], // first name only for brevity
    fullName:  m.name,
    Assigned:  m.totalTasks,
    Completed: m.completedTasks,
    Overdue:   m.overdueTasks,
    isIdle:    m.isIdle,
    isOverload: m.isOverloaded,
  }));

  // Overloaded members table row
  const overloadedMembers = memberStats.filter(m => m.isOverloaded);
  const idleMembers       = memberStats.filter(m => m.isIdle);

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
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">
          Team Workload
        </p>
        <div className="flex gap-2">
          {overloadedMembers.length > 0 && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#FEF2F2', color: '#DC2626' }}>
              {overloadedMembers.length} overloaded
            </span>
          )}
          {idleMembers.length > 0 && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#F3F4F6', color: '#6B7280' }}>
              {idleMembers.length} idle
            </span>
          )}
        </div>
      </div>

      {/* Bar chart */}
      <ResponsiveContainer width="100%" height={Math.max(200, memberStats.length * 40)}>
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 16, left: -10, bottom: 5 }}
          barGap={2}
          barCategoryGap="30%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: '#6B7280' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(21,93,252,0.05)' }} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: '#6B7280', paddingTop: 8 }}
          />
          <Bar dataKey="Assigned"  fill="#155DFC" radius={[3, 3, 0, 0]} maxBarSize={18} />
          <Bar dataKey="Completed" fill="#16A34A" radius={[3, 3, 0, 0]} maxBarSize={18} />
          <Bar dataKey="Overdue"   fill="#EF4444" radius={[3, 3, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>

      {/* Member table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-[#F3F4F6]">
              {['Member', 'Role', 'Assigned', 'Completed', 'Overdue', 'Rate'].map(h => (
                <th key={h} className="pb-2 text-left font-bold text-[#9CA3AF] uppercase tracking-wider text-[9px] pr-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {memberStats.map((m, i) => {
              const rateColor = m.completionRate >= 80 ? '#16A34A' : m.completionRate >= 50 ? '#F59E0B' : '#EF4444';
              return (
                <tr
                  key={i}
                  onClick={() => onMemberFilter(activeMember === m.name ? '' : m.name)}
                  className="border-b border-[#F9FAFB] hover:bg-[#F8FAFF] cursor-pointer transition-colors"
                  style={{ opacity: !activeMember || activeMember === m.name ? 1 : 0.4 }}
                >
                  <td className="py-2 pr-3 font-semibold text-[#1F2937]">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black text-white shrink-0"
                        style={{ background: m.isIdle ? '#9CA3AF' : m.isOverloaded ? '#DC2626' : '#155DFC' }}
                      >
                        {m.name.charAt(0)}
                      </div>
                      {m.name}
                      {m.isIdle && (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#F3F4F6', color: '#6B7280' }}>Idle</span>
                      )}
                      {m.isOverloaded && (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#FEF2F2', color: '#DC2626' }}>Busy</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-[#6B7280]">{m.role}</td>
                  <td className="py-2 pr-3 font-bold text-[#1F2937]">{m.totalTasks}</td>
                  <td className="py-2 pr-3 font-bold text-[#16A34A]">{m.completedTasks}</td>
                  <td className="py-2 pr-3 font-bold" style={{ color: m.overdueTasks > 0 ? '#DC2626' : '#9CA3AF' }}>
                    {m.overdueTasks || '—'}
                  </td>
                  <td className="py-2">
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-black"
                      style={{ background: `${rateColor}18`, color: rateColor }}
                    >
                      {m.totalTasks > 0 ? `${m.completionRate}%` : '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {activeMember && (
        <button
          onClick={() => onMemberFilter('')}
          className="mt-3 text-[10px] font-semibold text-[#155DFC] hover:underline"
        >
          × Clear member filter
        </button>
      )}
    </div>
  );
}
