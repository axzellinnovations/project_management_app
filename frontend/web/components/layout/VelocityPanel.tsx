'use client';

import { useEffect, useState } from 'react';
import VelocityChart from '@/app/(project)/(agile)/sprint-backlog/components/VelocityChart';
import api from '@/lib/axios';
import type { SprintItem, TaskItem } from '@/types';

interface VelocityPanelProps {
  projectId: string | null;
  onClose: () => void;
}

type RawTask = {
  id: number;
  title: string;
  storyPoint: number;
  assigneeName?: string;
  assigneePhotoUrl?: string | null;
  sprintId?: number | null;
  status?: string;
  startDate?: string;
  dueDate?: string;
  priority?: string;
  taskNo?: number;
};

type RawSprint = {
  id: number;
  name: string;
  status: string;
  startDate?: string;
  endDate?: string;
  goal?: string;
};

export default function VelocityPanel({ projectId, onClose }: VelocityPanelProps) {
  const [sprints, setSprints] = useState<SprintItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError(false);
      try {
        const [sprintsRes, tasksRes] = await Promise.all([
          api.get<RawSprint[]>(`/api/sprints/project/${projectId}`),
          api.get<RawTask[]>(`/api/tasks/project/${projectId}`),
        ]);
        if (controller.signal.aborted) return;
        const tasks = tasksRes.data;
        const sprintItems: SprintItem[] = sprintsRes.data.map((s) => ({
          id: s.id,
          name: s.name,
          status: s.status,
          startDate: s.startDate,
          endDate: s.endDate,
          goal: s.goal,
          tasks: tasks
            .filter((t) => t.sprintId === s.id)
            .map(
              (t, i): TaskItem => ({
                id: t.id,
                taskNo: t.taskNo ?? i + 1,
                title: t.title,
                storyPoints: t.storyPoint,
                selected: false,
                assigneeName: t.assigneeName ?? 'Unassigned',
                assigneePhotoUrl: t.assigneePhotoUrl ?? null,
                sprintId: t.sprintId ?? null,
                status: t.status ?? 'TODO',
                startDate: t.startDate ?? '',
                dueDate: t.dueDate ?? '',
                priority: t.priority ?? 'LOW',
              }),
            ),
        }));
        setSprints(sprintItems);
      } catch {
        if (!controller.signal.aborted) {
          setError(true);
          setSprints([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [projectId]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-[200]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-out panel */}
      <div
        className="fixed right-0 top-0 h-screen z-[201] bg-white border-l border-[#E3E8EF] shadow-2xl flex flex-col"
        style={{ width: 'min(580px, 100vw)' }}
        role="dialog"
        aria-modal="true"
        aria-label="Sprint Velocity"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F2F4F7] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#155DFC"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <h2 className="text-[15px] font-bold text-[#101828]">Sprint Velocity</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#9AA3AE] hover:text-[#344054] transition-colors p-1.5 rounded-md hover:bg-[#F2F4F7]"
            aria-label="Close velocity panel"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="grid grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-14 bg-[#F2F4F7] rounded-lg" />
                ))}
              </div>
              <div className="h-[220px] bg-[#F2F4F7] rounded-xl" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mb-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B42318" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
              </div>
              <p className="text-[13px] font-medium text-[#344054]">Failed to load velocity data</p>
              <p className="text-[12px] text-[#667085] mt-1">Check your connection and try again.</p>
            </div>
          ) : (
            <VelocityChart sprints={sprints} />
          )}
        </div>
      </div>
    </>
  );
}
