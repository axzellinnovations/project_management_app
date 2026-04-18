'use client';

// ══════════════════════════════════════════════════════════════════════════════
//  GenerateReportModal.tsx
//  Premium modal for selecting and downloading PDF / Excel project reports
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, FileText, Table2, Download, CheckCircle2, Loader2,
  AlertTriangle, BarChart3, Layers, Users, Flag, Zap,
} from 'lucide-react';
import { Task, Sprint, ProjectMetrics, MilestoneResponse, TeamMemberInfo } from '@/types';
import { buildReportData } from '@/lib/report/reportUtils';
import { generatePDFReport } from '@/lib/report/pdfReportGenerator';
import { generateExcelReport } from '@/lib/report/excelReportGenerator';

// ── Types ────────────────────────────────────────────────────────────────────
type ReportFormat = 'pdf' | 'excel' | 'both';
type DownloadState = 'idle' | 'loading' | 'done' | 'error';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  projectDetails: {
    name?: string;
    description?: string;
    type?: string;
  };
  tasks: Task[];
  sprints: Sprint[];
  metrics: ProjectMetrics;
  milestones: MilestoneResponse[];
  members: TeamMemberInfo[];
  isAgile: boolean;
}

// ── Mini stat for the preview panel ─────────────────────────────────────────
function PreviewStat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
      <span className="text-[22px] font-black leading-none" style={{ color }}>{value}</span>
      <span className="text-[10px] text-white/50 font-semibold mt-1 uppercase tracking-wider text-center">{label}</span>
    </div>
  );
}

// ── Format option card ────────────────────────────────────────────────────────
function FormatCard({
  title, description, icon, gradient, selected, onSelect, features,
}: {
  id: ReportFormat; title: string; description: string; icon: React.ReactNode;
  color: string; gradient: string; selected: boolean; onSelect: () => void; features: string[];
}) {
  return (
    <motion.button
      onClick={onSelect}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      className={`relative w-full text-left rounded-2xl border-2 p-5 transition-all duration-200 cursor-pointer overflow-hidden ${
        selected
          ? 'border-white/40 shadow-xl shadow-black/20'
          : 'border-white/10 hover:border-white/20'
      }`}
      style={{ background: selected ? gradient : 'rgba(255,255,255,0.04)' }}
    >
      {selected && (
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center"
        >
          <CheckCircle2 size={14} className="text-white" />
        </motion.div>
      )}

      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: selected ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)' }}
        >
          {icon}
        </div>
        <div>
          <h4 className="font-bold text-[15px] text-white leading-tight">{title}</h4>
          <p className="text-[11px] text-white/60 mt-0.5">{description}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-2">
        {features.map(f => (
          <span
            key={f}
            className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: selected ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
              color: selected ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
            }}
          >
            {f}
          </span>
        ))}
      </div>
    </motion.button>
  );
}

// ── Section included row ──────────────────────────────────────────────────────
function IncludedRow({ icon, label, count }: { icon: React.ReactNode; label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-white/5">
      <div className="w-6 h-6 rounded-lg bg-white/[0.08] flex items-center justify-center shrink-0 text-white/60">
        {icon}
      </div>
      <span className="text-[12px] text-white/70 flex-1">{label}</span>
      {count !== undefined && (
        <span className="text-[11px] font-bold text-white/40">{count}</span>
      )}
      <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  MODAL COMPONENT
// ════════════════════════════════════════════════════════════════════════════
export function GenerateReportModal({
  isOpen, onClose, projectDetails, tasks, sprints, metrics,
  milestones, members, isAgile,
}: Props) {
  const [format, setFormat] = useState<ReportFormat>('both');
  const [pdfState, setPdfState] = useState<DownloadState>('idle');
  const [excelState, setExcelState] = useState<DownloadState>('idle');

  const isLoading = pdfState === 'loading' || excelState === 'loading';

  const completionPct = metrics.totalTasks
    ? Math.round((metrics.completedTasks / metrics.totalTasks) * 100) : 0;

  const handleGenerate = useCallback(async () => {
    const data = buildReportData(
      projectDetails,
      tasks, sprints, metrics, milestones,
      members.map(m => ({
        id: m.id,
        userId: m.user.userId,       // ← used to match task.assigneeId
        role: m.role,
        user: { fullName: m.user.fullName, username: m.user.username },
      })),
      isAgile,
    );

    const shouldPdf   = format === 'pdf'   || format === 'both';
    const shouldExcel = format === 'excel' || format === 'both';

    if (shouldPdf)   setPdfState('loading');
    if (shouldExcel) setExcelState('loading');

    try {
      if (shouldPdf && shouldExcel) {
        await generatePDFReport(data);
        setPdfState('done');
        await generateExcelReport(data);
        setExcelState('done');
      } else if (shouldPdf) {
        await generatePDFReport(data);
        setPdfState('done');
      } else {
        await generateExcelReport(data);
        setExcelState('done');
      }
    } catch (err) {
      console.error('[GenerateReport] Report generation failed:', err);
      if (shouldPdf)   setPdfState('error');
      if (shouldExcel) setExcelState('error');
    }

    // Auto-reset after 8s (longer so user can read error message)
    setTimeout(() => {
      setPdfState('idle');
      setExcelState('idle');
    }, 8000);
  }, [format, projectDetails, tasks, sprints, metrics, milestones, members, isAgile]);

  const handleClose = () => {
    if (!isLoading) {
      setPdfState('idle');
      setExcelState('idle');
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          onClick={handleClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="relative z-10 w-full max-w-[780px] rounded-3xl overflow-hidden shadow-2xl shadow-black/50"
            onClick={e => e.stopPropagation()}
          >
            {/* ── Outer gradient shell ── */}
            <div className="bg-[#0B1120] relative">
              {/* Decorative blobs */}
              <div className="absolute -top-20 -left-20 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-purple-600/[0.15] rounded-full blur-3xl pointer-events-none" />

              {/* ── Header ── */}
              <div className="relative px-7 pt-7 pb-5 border-b border-white/[0.08]">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0052CC] to-[#2684FF] flex items-center justify-center shadow-lg shadow-blue-500/30">
                      <BarChart3 size={22} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-[18px] font-black text-white leading-tight">Generate Project Report</h2>
                      <p className="text-[12px] text-white/50 mt-0.5">
                        {isAgile ? '⚡ Agile / Scrum' : '📋 Kanban'} · {projectDetails.name || 'Project'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    disabled={isLoading}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* KPI preview strip */}
                <div className="grid grid-cols-4 gap-2.5 mt-5">
                  <PreviewStat label="Total Tasks"     value={metrics.totalTasks}     color="#2684FF" />
                  <PreviewStat label="Completed"        value={metrics.completedTasks}  color="#36B37E" />
                  <PreviewStat label="Overdue"          value={metrics.overdueTasks}    color="#FF5630" />
                  <PreviewStat label="Completion"       value={`${completionPct}%`}     color="#FFC400" />
                </div>
              </div>

              {/* ── Body ── */}
              <div className="relative px-7 py-5 grid grid-cols-[1fr_1px_220px] gap-0">

                {/* Left: Format selection */}
                <div className="pr-6">
                  <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3">
                    Choose Format
                  </p>
                  <div className="flex flex-col gap-3">
                    <FormatCard
                      id="pdf"
                      title="PDF Report"
                      description="Beautifully formatted print-ready document"
                      icon={<FileText size={18} className="text-white" />}
                      color="#E53935"
                      gradient="linear-gradient(135deg, rgba(229,57,53,0.25) 0%, rgba(183,28,28,0.15) 100%)"
                      selected={format === 'pdf'}
                      onSelect={() => setFormat('pdf')}
                      features={['Charts', 'Tables', 'Cover Page', 'Branded', 'A4 Format']}
                    />
                    <FormatCard
                      id="excel"
                      title="Excel Workbook"
                      description="Multi-sheet spreadsheet with color-coded data"
                      icon={<Table2 size={18} className="text-white" />}
                      color="#1B5E20"
                      gradient="linear-gradient(135deg, rgba(27,94,32,0.25) 0%, rgba(46,125,50,0.15) 100%)"
                      selected={format === 'excel'}
                      onSelect={() => setFormat('excel')}
                      features={['5 Sheets', 'Color Coded', 'Filterable', 'Formulas', '.xlsx']}
                    />
                    <FormatCard
                      id="both"
                      title="Both Formats"
                      description="Download PDF + Excel simultaneously"
                      icon={<Download size={18} className="text-white" />}
                      color="#7B1FA2"
                      gradient="linear-gradient(135deg, rgba(123,31,162,0.25) 0%, rgba(74,20,140,0.15) 100%)"
                      selected={format === 'both'}
                      onSelect={() => setFormat('both')}
                      features={['PDF', 'Excel', 'Complete', 'Recommended']}
                    />
                  </div>
                </div>

                {/* Divider */}
                <div className="bg-white/[0.08] mx-0" />

                {/* Right: what's included */}
                <div className="pl-6">
                  <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3">
                    Included Sections
                  </p>
                  <div className="flex flex-col">
                    <IncludedRow icon={<BarChart3 size={13} />} label="Project Overview & KPIs" />
                    <IncludedRow icon={<Layers size={13} />}     label="Task Breakdown"     count={tasks.length} />
                    <IncludedRow icon={<BarChart3 size={13} />}  label="Priority & Status Charts" />
                    {isAgile && (
                      <IncludedRow icon={<Zap size={13} />}       label="Sprint Analysis"    count={sprints.length} />
                    )}
                    {!isAgile && (
                      <IncludedRow icon={<Layers size={13} />}   label="Kanban Status Flow" />
                    )}
                    <IncludedRow icon={<Users size={13} />} label="Team Workload"      count={members.length} />
                    {milestones.length > 0 && (
                      <IncludedRow icon={<Flag size={13} />}    label="Milestones"         count={milestones.length} />
                    )}
                  </div>

                  {/* Status indicators below */}
                  {(pdfState !== 'idle' || excelState !== 'idle') && (
                    <div className="mt-4 flex flex-col gap-1.5">
                      {(format === 'pdf' || format === 'both') && (
                        <StatusPill state={pdfState} label="PDF" />
                      )}
                      {(format === 'excel' || format === 'both') && (
                        <StatusPill state={excelState} label="Excel" />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Footer / CTA ── */}
              <div className="relative px-7 pb-7">
                <div className="h-px bg-white/[0.08] mb-5" />
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[11px] text-white/30 max-w-[280px] leading-relaxed">
                    Report captures all data up to{' '}
                    <span className="text-white/50 font-medium">{new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </p>
                  <motion.button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2.5 px-7 py-3 rounded-2xl font-bold text-[14px] text-white shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{
                      background: isLoading
                        ? 'rgba(255,255,255,0.1)'
                        : 'linear-gradient(135deg, #0052CC 0%, #2684FF 100%)',
                      boxShadow: isLoading ? 'none' : '0 8px 32px rgba(0,82,204,0.4)',
                    }}
                  >
                    {isLoading ? (
                      <><Loader2 size={16} className="animate-spin" /> Generating...</>
                    ) : (
                      <><Download size={16} className="transition-transform group-hover:translate-y-0.5" /> Download Report</>
                    )}
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Tiny status pill ─────────────────────────────────────────────────────────
function StatusPill({ state, label }: { state: DownloadState; label: string }) {
  const cfg = {
    idle:    { icon: null,                                  text: '',            bg: 'transparent', fg: '' },
    loading: { icon: <Loader2 size={11} className="animate-spin" />, text: `Generating ${label}…`, bg: 'rgba(0,82,204,0.2)',   fg: '#60A5FA' },
    done:    { icon: <CheckCircle2 size={11} />,            text: `${label} Downloaded ✓`, bg: 'rgba(0,135,90,0.2)',   fg: '#36B37E' },
    error:   { icon: <AlertTriangle size={11} />,           text: `${label} Failed`,       bg: 'rgba(222,53,11,0.2)',  fg: '#FF5630' },
  }[state];

  if (!cfg.text) return null;
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium" style={{ background: cfg.bg, color: cfg.fg }}>
      {cfg.icon}{cfg.text}
    </div>
  );
}
