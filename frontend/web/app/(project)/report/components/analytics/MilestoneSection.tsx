'use client';
// ══════════════════════════════════════════════════════════════════════════════
//  MilestoneSection.tsx  ·  Milestone cards grid with status + timeline
// ══════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { Flag, CheckCircle2, Clock, Archive } from 'lucide-react';
import { motion } from 'framer-motion';
import type { MilestoneResponse } from '@/types';

function getStatusConfig(status: string, dueDate?: string | null) {
  const isOverdue = dueDate && new Date(dueDate) < new Date() && status !== 'COMPLETED';
  if (status === 'COMPLETED') {
    return { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', label: 'Completed', Icon: CheckCircle2 };
  }
  if (status === 'ARCHIVED') {
    return { color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB', label: 'Archived', Icon: Archive };
  }
  if (isOverdue) {
    return { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', label: 'Overdue', Icon: Clock };
  }
  return { color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', label: 'Open', Icon: Flag };
}

function fmtShort(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface Props {
  milestones: MilestoneResponse[];
}

export default function MilestoneSection({ milestones }: Props) {
  if (!milestones.length) {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{
          background:     'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(20px)',
          border:         '1px solid rgba(255,255,255,0.65)',
          boxShadow:      '0 4px 24px rgba(0,0,0,0.05)',
        }}
      >
        <Flag size={24} className="text-[#D1D5DB] mx-auto mb-2" />
        <p className="text-[12px] text-[#9CA3AF]">No milestones defined for this project</p>
      </div>
    );
  }

  // Sort: overdue first, then open, then completed, then archived
  const ORDER = { Overdue: 0, Open: 1, Completed: 2, Archived: 3 };
  const sorted = [...milestones].sort((a, b) => {
    const la = getStatusConfig(a.status, a.dueDate).label;
    const lb = getStatusConfig(b.status, b.dueDate).label;
    return (ORDER[la as keyof typeof ORDER] ?? 99) - (ORDER[lb as keyof typeof ORDER] ?? 99);
  });

  const completed = milestones.filter(m => m.status === 'COMPLETED').length;
  const pct = milestones.length ? Math.round((completed / milestones.length) * 100) : 0;

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
        <div>
          <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">Milestones</p>
          <p className="text-[10px] text-[#B0B8C4] mt-0.5">
            {completed}/{milestones.length} completed · {pct}%
          </p>
        </div>
        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="w-28 h-2 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: pct >= 70 ? '#16A34A' : pct >= 40 ? '#F59E0B' : '#DC2626' }}
            />
          </div>
          <span className="text-[10px] font-bold text-[#6B7280]">{pct}%</span>
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sorted.map((m, i) => {
          const cfg = getStatusConfig(m.status, m.dueDate);
          return (
            <motion.div
              key={m.id ?? i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-xl p-4 relative overflow-hidden"
              style={{
                background: cfg.bg,
                border:     `1px solid ${cfg.border}`,
              }}
            >
              {/* Status icon */}
              <div className="flex items-start justify-between mb-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: `${cfg.color}18` }}
                >
                  <cfg.Icon size={13} style={{ color: cfg.color }} />
                </div>
                <span
                  className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider"
                  style={{ background: `${cfg.color}18`, color: cfg.color }}
                >
                  {cfg.label}
                </span>
              </div>

              {/* Name */}
              <p className="text-[12px] font-bold text-[#1F2937] leading-tight mb-2 line-clamp-2">
                {m.name}
              </p>

              {/* Meta */}
              <div className="flex items-center justify-between text-[10px] text-[#9CA3AF]">
                <span>
                  {m.dueDate ? (
                    <span style={{ color: cfg.label === 'Overdue' ? '#DC2626' : '#6B7280' }}>
                      📅 {fmtShort(m.dueDate)}
                    </span>
                  ) : '📅 No due date'}
                </span>
                {m.taskCount !== undefined && m.taskCount > 0 && (
                  <span className="font-semibold" style={{ color: cfg.color }}>
                    {m.taskCount} task{m.taskCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
