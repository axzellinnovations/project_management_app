'use client';
// ══════════════════════════════════════════════════════════════════════════════
//  KpiStrip.tsx  ·  Row of 6 KPI stat cards — Planora Report Studio
// ══════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { motion } from 'framer-motion';

interface KpiProps {
  label:       string;
  value:       string | number;
  sub?:        string;
  color:       string;
  Icon:        React.ElementType;
  urgent?:     boolean;
}

function KpiCard({ label, value, sub, color, Icon, urgent }: KpiProps) {
  return (
    <motion.div
      whileHover={{ y: -3, boxShadow: `0 8px 32px ${color}20` }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="flex-1 min-w-[110px] rounded-2xl p-4 relative overflow-hidden"
      style={{
        background: urgent
          ? `linear-gradient(135deg, #fff0f0, ${color}12)`
          : 'rgba(255,255,255,0.85)',
        border:     `1px solid ${urgent ? color + '35' : color + '18'}`,
        boxShadow:  urgent
          ? `0 4px 20px ${color}22`
          : '0 2px 12px rgba(0,0,0,0.05)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* Accent blob */}
      <div
        className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-10 pointer-events-none"
        style={{ background: color }}
      />
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center mb-3"
        style={{ background: `${color}18` }}
      >
        <Icon size={15} style={{ color }} />
      </div>
      <div className="text-[24px] font-black leading-none mb-1" style={{ color }}>
        {value}
      </div>
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#9CA3AF]">
        {label}
      </div>
      {sub && (
        <div className="text-[9px] text-[#B0B8C4] mt-0.5 leading-tight">{sub}</div>
      )}
    </motion.div>
  );
}

// ── Strip ─────────────────────────────────────────────────────────────────────
import {
  CheckCircle2, AlertTriangle, Users, Clock, Target, TrendingUp,
} from 'lucide-react';
import type { ReportData } from '@/lib/report/reportUtils';

interface StripProps { data: ReportData }

export default function KpiStrip({ data }: StripProps) {
  const { metrics, completionPct, overduePct, memberStats, activeSprint, isAgile } = data;

  const cards: KpiProps[] = [
    {
      label: 'Total Tasks',
      value: metrics.totalTasks,
      sub:   `${data.tasks.length} valid tasks`,
      color: '#155DFC',
      Icon:  Target,
    },
    {
      label: 'Completed',
      value: metrics.completedTasks,
      sub:   `${completionPct}% completion rate`,
      color: '#16A34A',
      Icon:  CheckCircle2,
    },
    {
      label: 'Completion %',
      value: `${completionPct}%`,
      sub:   completionPct >= 70 ? 'On track 🟢' : completionPct >= 40 ? 'In progress 🟡' : 'At risk 🔴',
      color: completionPct >= 70 ? '#16A34A' : completionPct >= 40 ? '#F59E0B' : '#DC2626',
      Icon:  TrendingUp,
    },
    {
      label:  'Overdue',
      value:  metrics.overdueTasks,
      sub:    `${overduePct}% overdue rate`,
      color:  '#DC2626',
      Icon:   AlertTriangle,
      urgent: metrics.overdueTasks > 0,
    },
    {
      label: 'Team Size',
      value: memberStats.length,
      sub:   data.idleMemberCount > 0 ? `${data.idleMemberCount} idle` : 'All active',
      color: '#7C3AED',
      Icon:  Users,
    },
    ...(isAgile && activeSprint
      ? [{
          label: 'Active Sprint',
          value: `${activeSprint.completionRate}%`,
          sub:   activeSprint.name,
          color: '#0891B2' as string,
          Icon:  Clock,
        }]
      : [{
          label: 'Avg Lead Time',
          value: `${data.avgLeadTimeDays}d`,
          sub:   'avg task completion time',
          color: '#0891B2' as string,
          Icon:  Clock,
        }]
    ),
  ];

  return (
    <div className="flex gap-3 flex-wrap">
      {cards.map((c, i) => (
        <KpiCard key={i} {...c} />
      ))}
    </div>
  );
}
