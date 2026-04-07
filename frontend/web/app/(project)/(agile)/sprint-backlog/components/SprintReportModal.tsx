'use client';

import { useMemo } from 'react';
import { X, BarChart3, CheckCircle2, Clock, AlertTriangle, Users } from 'lucide-react';
import type { SprintItem } from '@/types';

interface SprintReportModalProps {
  sprint: SprintItem;
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  TODO: { label: 'To Do', color: '#344054', bg: '#F2F4F7' },
  IN_PROGRESS: { label: 'In Progress', color: '#175CD3', bg: '#EFF8FF' },
  IN_REVIEW: { label: 'In Review', color: '#B54708', bg: '#FFFAEB' },
  DONE: { label: 'Done', color: '#027A48', bg: '#ECFDF3' },
};

export default function SprintReportModal({ sprint, isOpen, onClose }: SprintReportModalProps) {
  const tasks = sprint.tasks;
  const totalTasks = tasks.length;
  const totalPoints = tasks.reduce((a, t) => a + (t.storyPoints || 0), 0);

  const statusBreakdown = useMemo(() => {
    const map: Record<string, { count: number; points: number }> = {};
    for (const t of tasks) {
      const s = t.status ?? 'TODO';
      if (!map[s]) map[s] = { count: 0, points: 0 };
      map[s].count++;
      map[s].points += t.storyPoints || 0;
    }
    return map;
  }, [tasks]);

  const assigneeBreakdown = useMemo(() => {
    const map: Record<string, { count: number; points: number; done: number }> = {};
    for (const t of tasks) {
      const name = t.assigneeName || 'Unassigned';
      if (!map[name]) map[name] = { count: 0, points: 0, done: 0 };
      map[name].count++;
      map[name].points += t.storyPoints || 0;
      if (t.status === 'DONE') map[name].done++;
    }
    return Object.entries(map).sort((a, b) => b[1].points - a[1].points);
  }, [tasks]);

  const completedTasks = statusBreakdown['DONE']?.count ?? 0;
  const completedPoints = statusBreakdown['DONE']?.points ?? 0;
  const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const pointsPct = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto rounded-2xl border border-[#E4E7EC] bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#EAECF0] bg-white px-6 py-4 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <BarChart3 size={20} className="text-[#155DFC]" />
            <h2 className="text-[16px] font-bold text-[#101828]">Sprint Report</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#667085] hover:bg-[#F2F4F7] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Sprint info */}
          <div>
            <h3 className="text-[18px] font-bold text-[#101828]">{sprint.name}</h3>
            {sprint.goal && (
              <p className="mt-1 text-[13px] text-[#667085] italic">&ldquo;{sprint.goal}&rdquo;</p>
            )}
            <div className="mt-2 flex flex-wrap gap-3 text-[12px] text-[#667085]">
              {sprint.startDate && <span>Start: {sprint.startDate}</span>}
              {sprint.endDate && <span>End: {sprint.endDate}</span>}
              <span className="rounded-full border border-[#D0D5DD] px-2 py-0.5 font-medium text-[#344054]">
                {sprint.status?.replace('_', ' ')}
              </span>
            </div>
          </div>

          {/* Completion ring */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-[#EAECF0] bg-[#F9FAFB] p-4 text-center">
              <div className="relative mx-auto h-20 w-20">
                <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
                  <path
                    d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#E4E7EC"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#155DFC"
                    strokeWidth="3"
                    strokeDasharray={`${completionPct}, 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[16px] font-bold text-[#101828]">
                  {completionPct}%
                </span>
              </div>
              <p className="mt-2 text-[12px] font-medium text-[#667085]">Tasks Done</p>
              <p className="text-[13px] font-bold text-[#344054]">{completedTasks}/{totalTasks}</p>
            </div>

            <div className="rounded-xl border border-[#EAECF0] bg-[#F9FAFB] p-4 text-center">
              <div className="relative mx-auto h-20 w-20">
                <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
                  <path
                    d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#E4E7EC"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#039855"
                    strokeWidth="3"
                    strokeDasharray={`${pointsPct}, 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[16px] font-bold text-[#101828]">
                  {pointsPct}%
                </span>
              </div>
              <p className="mt-2 text-[12px] font-medium text-[#667085]">Points Done</p>
              <p className="text-[13px] font-bold text-[#344054]">{completedPoints}/{totalPoints} pts</p>
            </div>
          </div>

          {/* Status breakdown */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={16} className="text-[#667085]" />
              <h4 className="text-[14px] font-bold text-[#101828]">Status Breakdown</h4>
            </div>
            <div className="space-y-2">
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                const data = statusBreakdown[key];
                if (!data) return null;
                const pct = totalTasks > 0 ? Math.round((data.count / totalTasks) * 100) : 0;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span
                      className="w-20 text-[12px] font-medium rounded-full px-2 py-0.5 text-center"
                      style={{ backgroundColor: cfg.bg, color: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-[#F2F4F7] overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: cfg.color }} />
                    </div>
                    <span className="text-[12px] font-bold text-[#344054] w-16 text-right">{data.count} ({data.points}pt)</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Assignee breakdown */}
          {assigneeBreakdown.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users size={16} className="text-[#667085]" />
                <h4 className="text-[14px] font-bold text-[#101828]">Team Contribution</h4>
              </div>
              <div className="rounded-xl border border-[#EAECF0] overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[#F9FAFB] text-[#667085] text-left">
                      <th className="px-4 py-2 font-medium">Assignee</th>
                      <th className="px-4 py-2 font-medium text-center">Tasks</th>
                      <th className="px-4 py-2 font-medium text-center">Points</th>
                      <th className="px-4 py-2 font-medium text-center">Done</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assigneeBreakdown.map(([name, data]) => (
                      <tr key={name} className="border-t border-[#EAECF0]">
                        <td className="px-4 py-2 font-medium text-[#344054]">{name}</td>
                        <td className="px-4 py-2 text-center text-[#667085]">{data.count}</td>
                        <td className="px-4 py-2 text-center text-[#667085]">{data.points}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`font-bold ${data.done === data.count && data.count > 0 ? 'text-[#027A48]' : 'text-[#667085]'}`}>
                            {data.done}/{data.count}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Risks */}
          {tasks.some(t => t.status !== 'DONE' && t.storyPoints >= 8) && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-[#F79009]" />
                <h4 className="text-[14px] font-bold text-[#101828]">Risks</h4>
              </div>
              <ul className="space-y-1">
                {tasks.filter(t => t.status !== 'DONE' && t.storyPoints >= 8).map(t => (
                  <li key={t.id} className="flex items-center gap-2 text-[12px] text-[#B54708] bg-[#FFFAEB] rounded-lg px-3 py-2">
                    <Clock size={12} />
                    <span className="font-medium">{t.title}</span>
                    <span className="text-[#98A2B3]">({t.storyPoints}pt, {t.status?.replace('_', ' ')})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
