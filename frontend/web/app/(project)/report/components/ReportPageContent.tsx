'use client';
// ══════════════════════════════════════════════════════════════════════════════
//  ReportPageContent.tsx  ·  Planora Report Studio — Analytics Dashboard
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download, CalendarClock, BarChart3, RefreshCw,
  Flag, Users, AlertTriangle, Sparkles, FileText,
  Zap, Shield, Table2,
} from 'lucide-react';
import useSWR from 'swr';

import { Task, Sprint, ProjectMetrics, MilestoneResponse, TeamMemberInfo } from '@/types';
import { buildReportData }       from '@/lib/report/reportUtils';
import DownloadNowModal          from './DownloadNowModal';
import ScheduleReportModal       from './ScheduleReportModal';
import {
  getProjectScheduledReports, deleteScheduledReport,
  pauseScheduledReport, resumeScheduledReport, ScheduledReportResponse,
} from '@/services/report-schedule-service';

// ── Analytics components ──────────────────────────────────────────────────────
import KpiStrip                         from './analytics/KpiStrip';
import { StatusChart, PriorityChart }   from './analytics/DistributionCharts';
import WorkloadChart                    from './analytics/WorkloadChart';
import SprintChart                      from './analytics/SprintChart';
import { OverdueTable, UpcomingTable }  from './analytics/TaskAlerts';
import FullTaskTable, { TaskTableFilters } from './analytics/FullTaskTable';
import MilestoneSection                 from './analytics/MilestoneSection';

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  projectId:  number;
  tasks:      Task[];
  sprints:    Sprint[];
  metrics:    ProjectMetrics;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  project:    any;
  milestones: MilestoneResponse[];
  members:    TeamMemberInfo[];
  isAgile:    boolean;
}

// ── Compact action button ─────────────────────────────────────────────────────
function ActionBtn({
  label, sub, Icon, gradient, onClick, 'data-id': dataId,
}: {
  label: string; sub: string; Icon: React.ElementType;
  gradient: string; onClick: () => void; 'data-id': string;
}) {
  return (
    <motion.button
      data-id={dataId}
      onClick={onClick}
      whileHover={{ scale: 1.03, y: -1 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className="flex items-center gap-3 px-5 py-3 rounded-2xl text-left relative overflow-hidden"
      style={{
        background:     gradient,
        boxShadow:      '0 4px 20px rgba(21,93,252,0.25)',
        minWidth:       160,
      }}
    >
      <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
        <Icon size={16} className="text-white" />
      </div>
      <div>
        <p className="text-[13px] font-black text-white leading-tight">{label}</p>
        <p className="text-[10px] text-white/70">{sub}</p>
      </div>
    </motion.button>
  );
}

// ── Active schedule row ────────────────────────────────────────────────────────
import { Loader2, Pause, Trash2 } from 'lucide-react';

function ScheduleRow({
  sr, onDelete, onToggle,
}: {
  sr: ScheduledReportResponse;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const [delLoading, setDelLoading] = useState(false);
  const [togLoading, setTogLoading] = useState(false);

  const statusColor = sr.status === 'ACTIVE' ? '#16A34A'
    : sr.status === 'PAUSED' ? '#F59E0B' : '#DC2626';

  const freqLabel = (() => {
    if (sr.scheduleType === 'ONE_TIME') return `Once on ${sr.scheduledDate || '—'}`;
    switch (sr.frequency) {
      case 'DAILY':   return `Daily at ${sr.sendTime}`;
      case 'WEEKLY':  return `Weekly (day ${sr.sendDayOfWeek}) at ${sr.sendTime}`;
      case 'MONTHLY': return `Monthly (day ${sr.sendDayOfMonth}) at ${sr.sendTime}`;
      case 'CUSTOM':  return `Every ${sr.customIntervalDays}d at ${sr.sendTime}`;
      default:        return sr.sendTime;
    }
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="flex items-center gap-3 p-3 rounded-xl border border-[#F3F4F6] bg-white/60 hover:bg-white transition-colors"
    >
      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: statusColor }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-[#1F2937]">{freqLabel}</span>
          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase" style={{ background: '#EBF2FF', color: '#155DFC' }}>
            {sr.format}
          </span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase" style={{ background: `${statusColor}15`, color: statusColor }}>
            {sr.status}
          </span>
        </div>
        <p className="text-[10px] text-[#9CA3AF] mt-0.5 truncate">
          To: {sr.recipientsTo.join(', ')}
          {sr.nextSendAt && ` · Next: ${new Date(sr.nextSendAt).toLocaleString()}`}
          {` · Sent: ${sr.sendCount}×`}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {(sr.status === 'ACTIVE' || sr.status === 'PAUSED') && (
          <button
            onClick={async () => { setTogLoading(true); await onToggle(); setTogLoading(false); }}
            disabled={togLoading}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:bg-[#F3F4F6] transition-colors"
          >
            {togLoading ? <Loader2 size={12} className="animate-spin" /> :
             sr.status === 'ACTIVE' ? <Pause size={12} /> : <RefreshCw size={12} />}
          </button>
        )}
        <button
          onClick={async () => { setDelLoading(true); await onDelete(); setDelLoading(false); }}
          disabled={delLoading}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:bg-red-50 hover:text-red-500 transition-colors"
        >
          {delLoading ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        </button>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function ReportPageContent({
  projectId, tasks, sprints, metrics, project, milestones, members, isAgile,
}: Props) {

  // Modal state
  const [dlOpen,  setDlOpen]  = useState(false);
  const [schOpen, setSchOpen] = useState(false);

  // Active filter state — controlled by both chart clicks and table dropdowns
  const [filters, setFilters] = useState<TaskTableFilters>({
    status: '', priority: '', assignee: '', sprint: '',
  });
  const updateFilter = useCallback((partial: Partial<TaskTableFilters>) => {
    setFilters(f => ({ ...f, ...partial }));
  }, []);

  // Member filter for workload chart click
  const [memberFilter, setMemberFilter] = useState('');

  // Build report data (memoized)
  const reportData = useMemo(() => buildReportData(
    project,
    tasks,
    sprints,
    metrics,
    milestones,
    members.map(m => ({
      id:     m.id,
      userId: m.user.userId,
      role:   m.role,
      user:   { fullName: m.user.fullName, username: m.user.username },
    })),
    isAgile,
  ), [project, tasks, sprints, metrics, milestones, members, isAgile]);

  // Scheduled reports
  const { data: schedules = [], mutate: mutateSchedules } = useSWR<ScheduledReportResponse[]>(
    projectId ? `scheduled-reports-${projectId}` : null,
    () => getProjectScheduledReports(projectId),
  );

  const handleDelete = async (id: number) => { await deleteScheduledReport(id); mutateSchedules(); };
  const handleToggle = async (sr: ScheduledReportResponse) => {
    if (sr.status === 'ACTIVE') await pauseScheduledReport(sr.id);
    else                        await resumeScheduledReport(sr.id);
    mutateSchedules();
  };

  // Unique values for table dropdowns (derived from data)
  const allAssignees = useMemo(() =>
    [...new Set(reportData.tasks.map(t => t.assignee).filter(a => a !== '—'))].sort(),
  [reportData.tasks]);

  const allSprints = useMemo(() =>
    [...new Set(reportData.tasks.map(t => t.sprint).filter(s => s !== '—'))].sort(),
  [reportData.tasks]);

  // Member chart click → update assignee filter in task table
  const handleMemberFilter = useCallback((name: string) => {
    setMemberFilter(name);
    updateFilter({ assignee: name });
  }, [updateFilter]);

  const hasActiveFilters = filters.status || filters.priority || filters.assignee || filters.sprint;

  return (
    <>
      {/* Modals */}
      <DownloadNowModal
        open={dlOpen}
        onClose={() => setDlOpen(false)}
        reportData={reportData}
        projectName={project?.name || 'Project'}
      />
      <ScheduleReportModal
        open={schOpen}
        onClose={() => { setSchOpen(false); mutateSchedules(); }}
        projectId={projectId}
        projectName={project?.name || 'Project'}
      />

      {/* Page */}
      <div
        className="w-full min-h-[calc(100vh-80px)] relative"
        style={{
          background: 'linear-gradient(160deg, #F8FAFF 0%, #F0F4FF 35%, #F8F9FF 70%, #FAFBFF 100%)',
        }}
      >
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-[480px] h-[480px] rounded-full opacity-[0.03] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #155DFC, transparent)', transform: 'translate(30%, -30%)' }}
        />
        <div className="absolute bottom-0 left-0 w-[360px] h-[360px] rounded-full opacity-[0.03] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #7C3AED, transparent)', transform: 'translate(-30%, 30%)' }}
        />

        <div className="relative z-10 px-4 py-8 max-w-[1400px] mx-auto space-y-6">

          {/* ── HEADER ───────────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-6"
            style={{
              background:     'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(20px) saturate(180%)',
              border:         '1px solid rgba(255,255,255,0.65)',
              boxShadow:      '0 4px 24px rgba(0,0,0,0.06)',
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Title area */}
              <div>
                {/* Planora branding */}
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg,#155DFC,#4D8BFF)' }}
                  >
                    <BarChart3 size={12} className="text-white" />
                  </div>
                  <span className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">
                    Planora · Report Studio
                  </span>
                </div>

                <h1 className="text-[22px] font-black text-[#1A1A2E] leading-tight">
                  {project?.name || 'Project'} Analytics
                </h1>

                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span
                    className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest"
                    style={{
                      background: isAgile ? '#EBF2FF' : '#F3E8FF',
                      color:      isAgile ? '#155DFC' : '#7C3AED',
                    }}
                  >
                    {isAgile ? '⚡ Agile / Scrum' : '📋 Kanban'}
                  </span>
                  <span className="text-[10px] text-[#9CA3AF]">
                    Generated {reportData.generatedAt}
                  </span>
                  {reportData.unassignedCount > 0 && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#FEF2F2', color: '#DC2626' }}>
                      ⚠ {reportData.unassignedCount} unassigned
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 flex-wrap">
                <ActionBtn
                  data-id="report-download-btn"
                  label="Download"
                  sub="PDF · Excel · Both"
                  Icon={Download}
                  gradient="linear-gradient(135deg,#155DFC 0%,#4D8BFF 100%)"
                  onClick={() => setDlOpen(true)}
                />
                <ActionBtn
                  data-id="report-schedule-btn"
                  label="Schedule"
                  sub="Email · Recurring"
                  Icon={CalendarClock}
                  gradient="linear-gradient(135deg,#7C3AED 0%,#A855F7 100%)"
                  onClick={() => setSchOpen(true)}
                />
              </div>
            </div>

            {/* Active sprint banner */}
            {isAgile && reportData.activeSprint && (
              <div
                className="mt-4 flex items-center gap-4 px-4 py-3 rounded-xl"
                style={{ background: '#EBF2FF', border: '1px solid #BFDBFE' }}
              >
                <div className="w-2 h-2 rounded-full bg-[#155DFC] animate-pulse" />
                <div className="flex-1">
                  <span className="text-[11px] font-bold text-[#155DFC]">Active Sprint: </span>
                  <span className="text-[11px] text-[#374151] font-semibold">{reportData.activeSprint.name}</span>
                  <span className="text-[10px] text-[#9CA3AF] ml-2">
                    {reportData.activeSprint.start} → {reportData.activeSprint.end}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-[#155DFC]">
                    {reportData.activeSprint.completionRate}%
                  </span>
                  <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: '#BFDBFE' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${reportData.activeSprint.completionRate}%`, background: '#155DFC' }}
                    />
                  </div>
                  <span className="text-[10px] text-[#9CA3AF]">
                    {reportData.activeSprint.completedTasks}/{reportData.activeSprint.totalTasks}
                  </span>
                </div>
              </div>
            )}
          </motion.div>

          {/* ── KPI STRIP ──────────────────────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <KpiStrip data={reportData} />
          </motion.div>

          {/* ── ACTIVE FILTER CHIPS ────────────────────────────────────────── */}
          <AnimatePresence>
            {hasActiveFilters && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-center gap-2 flex-wrap"
              >
                <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">
                  Filtered by:
                </span>
                {filters.status && (
                  <button
                    onClick={() => updateFilter({ status: '' })}
                    className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full hover:opacity-80 transition-opacity"
                    style={{ background: '#EBF2FF', color: '#155DFC' }}
                  >
                    Status: {filters.status} ×
                  </button>
                )}
                {filters.priority && (
                  <button
                    onClick={() => updateFilter({ priority: '' })}
                    className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full hover:opacity-80 transition-opacity"
                    style={{ background: '#FEF2F2', color: '#DC2626' }}
                  >
                    Priority: {filters.priority} ×
                  </button>
                )}
                {filters.assignee && (
                  <button
                    onClick={() => { updateFilter({ assignee: '' }); setMemberFilter(''); }}
                    className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full hover:opacity-80 transition-opacity"
                    style={{ background: '#F3E8FF', color: '#7C3AED' }}
                  >
                    Member: {filters.assignee} ×
                  </button>
                )}
                {filters.sprint && (
                  <button
                    onClick={() => updateFilter({ sprint: '' })}
                    className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full hover:opacity-80 transition-opacity"
                    style={{ background: '#ECFDF5', color: '#16A34A' }}
                  >
                    Sprint: {filters.sprint} ×
                  </button>
                )}
                <button
                  onClick={() => { setFilters({ status: '', priority: '', assignee: '', sprint: '' }); setMemberFilter(''); }}
                  className="text-[10px] font-semibold text-[#9CA3AF] hover:text-[#DC2626] transition-colors"
                >
                  Clear all
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── DISTRIBUTION CHARTS ────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="flex gap-4 flex-wrap"
          >
            <StatusChart
              data={reportData}
              activeStatus={filters.status}
              onFilter={s => updateFilter({ status: s })}
            />
            <PriorityChart
              data={reportData}
              activePriority={filters.priority}
              onFilter={p => updateFilter({ priority: p })}
            />
          </motion.div>

          {/* ── WORKLOAD + SPRINT ───────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className={`grid gap-4 ${isAgile && reportData.sprintStats.length > 0 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}
          >
            <WorkloadChart
              data={reportData}
              activeMember={memberFilter}
              onMemberFilter={handleMemberFilter}
            />
            {isAgile && reportData.sprintStats.length > 0 && (
              <SprintChart data={reportData} />
            )}
          </motion.div>

          {/* ── OVERDUE TASKS ───────────────────────────────────────────────── */}
          {reportData.overdueTasks.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
              <OverdueTable tasks={reportData.overdueTasks} />
            </motion.div>
          )}

          {/* ── UPCOMING TASKS ──────────────────────────────────────────────── */}
          {reportData.upcomingTasks.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
              <UpcomingTable tasks={reportData.upcomingTasks} />
            </motion.div>
          )}

          {/* ── FULL TASK TABLE ─────────────────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
            <FullTaskTable
              tasks={reportData.tasks}
              externalFilters={filters}
              onExternalChange={updateFilter}
              allAssignees={allAssignees}
              allSprints={allSprints}
            />
          </motion.div>

          {/* ── MILESTONES ─────────────────────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <MilestoneSection milestones={reportData.milestones} />
          </motion.div>

          {/* ── REPORT CONTENTS INFO ──────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="rounded-2xl p-5"
            style={{
              background:     'rgba(255,255,255,0.75)',
              backdropFilter: 'blur(20px)',
              border:         '1px solid rgba(255,255,255,0.60)',
              boxShadow:      '0 2px 16px rgba(0,0,0,0.04)',
            }}
          >
            <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-4">
              Export Contents
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { Icon: BarChart3, label: 'Project Overview & KPIs',       color: '#155DFC' },
                { Icon: Zap,       label: isAgile ? 'Sprint Analytics' : 'Kanban Flow', color: '#F59E0B' },
                { Icon: Users,     label: 'Team Workload Breakdown',        color: '#16A34A' },
                { Icon: AlertTriangle, label: 'Overdue & Risk Analysis',   color: '#DC2626' },
                { Icon: Flag,      label: 'Milestone Tracker',              color: '#7C3AED' },
                { Icon: FileText,  label: 'Full Task Table',                color: '#6B7280' },
              ].map(({ Icon, label, color }) => (
                <div key={label} className="flex items-center gap-2.5 p-3 rounded-xl" style={{ background: '#F8FAFF' }}>
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}15` }}>
                    <Icon size={12} style={{ color }} />
                  </div>
                  <span className="text-[10px] font-semibold text-[#374151] leading-tight">{label}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-[#F3F4F6]">
              {[
                { Icon: FileText, color: '#DC2626', border: '#FECACA', bg: '#FFF5F5', label: 'PDF', sub: 'Print-ready branded document' },
                { Icon: Table2,   color: '#16A34A', border: '#BBF7D0', bg: '#F0FDF4', label: 'Excel', sub: 'Multi-sheet workbook' },
                { Icon: Sparkles, color: '#155DFC', border: '#BFDBFE', bg: '#EBF2FF', label: 'Both', sub: 'Complete package' },
                { Icon: Shield,   color: '#7C3AED', border: '#E9D5FF', bg: '#FAF5FF', label: 'Secure', sub: 'Generated in-browser · no server upload' },
              ].map(({ Icon, color, border, bg, label, sub }) => (
                <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-xl border" style={{ borderColor: border, background: bg }}>
                  <Icon size={12} style={{ color }} />
                  <span className="text-[11px] font-bold" style={{ color }}>{label}</span>
                  <span className="text-[10px] text-[#9CA3AF]">{sub}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── ACTIVE SCHEDULES ───────────────────────────────────────────── */}
          {schedules.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="rounded-2xl p-5"
              style={{
                background:     'rgba(255,255,255,0.75)',
                backdropFilter: 'blur(20px)',
                border:         '1px solid rgba(255,255,255,0.60)',
                boxShadow:      '0 2px 16px rgba(0,0,0,0.04)',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">
                  Active Schedules
                </p>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: '#EBF2FF', color: '#155DFC' }}
                >
                  {schedules.filter(s => s.status === 'ACTIVE').length} active
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <AnimatePresence>
                  {schedules.map(sr => (
                    <ScheduleRow
                      key={sr.id}
                      sr={sr}
                      onDelete={() => handleDelete(sr.id)}
                      onToggle={() => handleToggle(sr)}
                    />
                  ))}
                </AnimatePresence>
              </div>
              <button
                onClick={() => setSchOpen(true)}
                className="mt-3 w-full h-9 rounded-xl border border-dashed border-[#155DFC]/30 text-[11px] font-semibold text-[#155DFC] hover:bg-[#EBF2FF] flex items-center justify-center gap-1.5 transition-colors"
              >
                <CalendarClock size={12} /> Add another schedule
              </button>
            </motion.div>
          )}

          {/* Footer */}
          <p className="text-center text-[10px] text-[#C4C9D4] pb-4">
            Planora Project Management Suite · Report generated {reportData.generatedAt}
          </p>

        </div>
      </div>
    </>
  );
}
