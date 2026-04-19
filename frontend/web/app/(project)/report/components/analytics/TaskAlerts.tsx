'use client';
// ══════════════════════════════════════════════════════════════════════════════
//  TaskAlerts.tsx  ·  Overdue + Upcoming task tables
// ══════════════════════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { AlertTriangle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import type { TaskSummary } from '@/lib/report/reportUtils';
import { PRIORITY_COLORS } from '@/lib/report/reportUtils';

const PRIORITY_BG: Record<string, string> = {
  URGENT: '#FEF2F2', HIGH: '#FFF7ED', MEDIUM: '#FEFCE8',
  NORMAL: '#EFF6FF', LOW:  '#F0FDF4', UNASSIGNED: '#F9FAFB',
};

function PriorityBadge({ p }: { p: string }) {
  const key = p.toUpperCase();
  return (
    <span
      className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider"
      style={{ background: PRIORITY_BG[key] ?? '#F9FAFB', color: PRIORITY_COLORS[key] ?? '#6B7280' }}
    >
      {p}
    </span>
  );
}

// ── Overdue Table ──────────────────────────────────────────────────────────────
interface OverdueProps { tasks: TaskSummary[] }

export function OverdueTable({ tasks }: OverdueProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? tasks : tasks.slice(0, 5);

  if (!tasks.length) return null;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background:     'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(20px)',
        border:         '1px solid #FECACA',
        boxShadow:      '0 4px 24px rgba(220,38,38,0.08)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ background: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)' }}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-white" />
          <span className="text-[12px] font-black text-white uppercase tracking-widest">
            Overdue Tasks
          </span>
          <span className="ml-2 text-[10px] font-black bg-white/25 text-white px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <span className="text-[10px] text-white/70">Requires immediate attention</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr style={{ background: '#FEF2F2', borderBottom: '1px solid #FECACA' }}>
              {['#', 'Task Title', 'Assignee', 'Due Date', 'Past Due', 'Priority'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-bold text-[#9CA3AF] uppercase tracking-wider text-[9px]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((t, i) => (
              <tr
                key={t.id}
                className="border-b border-[#FEF2F2] hover:bg-red-50/60 transition-colors"
              >
                <td className="px-4 py-2.5 font-bold text-[#DC2626]">{i + 1}</td>
                <td className="px-4 py-2.5 font-semibold text-[#1F2937] max-w-[240px]">
                  <span className="block truncate">{t.title}</span>
                </td>
                <td className="px-4 py-2.5 text-[#6B7280]">
                  {t.assignee === '—'
                    ? <span className="text-[#9CA3AF] italic">Unassigned</span>
                    : t.assignee}
                </td>
                <td className="px-4 py-2.5 text-[#6B7280]">{t.dueDate}</td>
                <td className="px-4 py-2.5">
                  <span className="font-black text-[#DC2626]">+{t.daysOverdue}d</span>
                </td>
                <td className="px-4 py-2.5">
                  <PriorityBadge p={t.priority} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Show more */}
      {tasks.length > 5 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full py-2.5 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#DC2626] hover:bg-red-50 transition-colors"
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {expanded ? 'Show less' : `Show ${tasks.length - 5} more overdue tasks`}
        </button>
      )}
    </div>
  );
}

// ── Upcoming Table ─────────────────────────────────────────────────────────────
interface UpcomingProps { tasks: TaskSummary[] }

function DaysBadge({ days }: { days: number }) {
  const color = days === 0 ? '#DC2626' : days <= 2 ? '#F97316' : '#16A34A';
  const label = days === 0 ? 'Due today' : days === 1 ? 'Tomorrow' : `${days}d left`;
  return (
    <span
      className="text-[9px] font-black px-2 py-0.5 rounded-full"
      style={{ background: `${color}18`, color }}
    >
      {label}
    </span>
  );
}

export function UpcomingTable({ tasks }: UpcomingProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? tasks : tasks.slice(0, 5);

  if (!tasks.length) return null;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background:     'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(20px)',
        border:         '1px solid #FED7AA',
        boxShadow:      '0 4px 24px rgba(249,115,22,0.07)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #F97316 100%)' }}
      >
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-white" />
          <span className="text-[12px] font-black text-white uppercase tracking-widest">
            Due This Week
          </span>
          <span className="ml-2 text-[10px] font-black bg-white/25 text-white px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <span className="text-[10px] text-white/70">Next 7 days</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr style={{ background: '#FFFBEB', borderBottom: '1px solid #FED7AA' }}>
              {['#', 'Task Title', 'Assignee', 'Due Date', 'Time Left', 'Priority'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-bold text-[#9CA3AF] uppercase tracking-wider text-[9px]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((t, i) => (
              <tr
                key={t.id}
                className="border-b border-[#FFFBEB] hover:bg-amber-50/60 transition-colors"
              >
                <td className="px-4 py-2.5 font-bold text-[#F59E0B]">{i + 1}</td>
                <td className="px-4 py-2.5 font-semibold text-[#1F2937] max-w-[240px]">
                  <span className="block truncate">{t.title}</span>
                </td>
                <td className="px-4 py-2.5 text-[#6B7280]">
                  {t.assignee === '—'
                    ? <span className="text-[#9CA3AF] italic">Unassigned</span>
                    : t.assignee}
                </td>
                <td className="px-4 py-2.5 text-[#6B7280]">{t.dueDate}</td>
                <td className="px-4 py-2.5">
                  <DaysBadge days={t.daysUntilDue} />
                </td>
                <td className="px-4 py-2.5">
                  <PriorityBadge p={t.priority} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tasks.length > 5 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full py-2.5 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#F59E0B] hover:bg-amber-50 transition-colors"
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {expanded ? 'Show less' : `Show ${tasks.length - 5} more`}
        </button>
      )}
    </div>
  );
}
