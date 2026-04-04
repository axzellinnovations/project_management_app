'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, User, Hash } from 'lucide-react';
import axios from '@/lib/axios';
import { toast } from '@/components/ui';

interface TeamMember {
  id: number;
  name: string;
}

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTask: (taskData: {
    title: string;
    priority: string;
    assigneeId?: number;
    storyPoint: number;
  }) => Promise<void>;
  projectId: number;
}

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low', color: 'bg-[#ECFDF3] text-[#027A48] border-[#A6F4C5]' },
  { value: 'MEDIUM', label: 'Medium', color: 'bg-[#FFFAEB] text-[#B54708] border-[#FEDF89]' },
  { value: 'HIGH', label: 'High', color: 'bg-[#FEF3F2] text-[#B42318] border-[#FECDCA]' },
  { value: 'CRITICAL', label: 'Critical', color: 'bg-[#FEE4E2] text-[#912018] border-[#FDA29B]' },
];

const FIBONACCI = [0, 1, 2, 3, 5, 8, 13, 21];

export default function CreateTaskModal({
  isOpen,
  onClose,
  onCreateTask,
  projectId,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [assignee, setAssignee] = useState<number | ''>('');
  const [storyPoint, setStoryPoint] = useState(0);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !projectId) return;

    const loadMembers = async () => {
      setLoadingMembers(true);
      try {
        const projectRes = await axios.get(`/api/projects/${projectId}`);
        const project = projectRes.data;
        const teamId = project.teamId ?? project.team?.id;
        if (teamId) {
          const membersRes = await axios.get(`/api/teams/${teamId}/members`);
          const payload = membersRes.data;
          const rawMembers = Array.isArray(payload) ? payload : [];
          setTeamMembers(
            rawMembers.map((m: { id: number; user?: { fullName?: string; username?: string } }) => ({
              id: m.id,
              name: m.user?.fullName ?? m.user?.username ?? 'Unknown',
            }))
          );
        }
      } catch {
        // non-critical — assignee dropdown will be empty
      } finally {
        setLoadingMembers(false);
      }
    };

    loadMembers();
  }, [isOpen, projectId]);

  const resetForm = () => {
    setTitle('');
    setPriority('MEDIUM');
    setAssignee('');
    setStoryPoint(0);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Task name is required');
      return;
    }

    setSubmitting(true);
    try {
      await onCreateTask({
        title: title.trim(),
        priority,
        assigneeId: assignee || undefined,
        storyPoint,
      });
      resetForm();
      onClose();
    } catch {
      setError('Failed to create task.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#00000040] z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="bg-[#155DFC] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Plus size={20} className="text-white" />
              <h2 className="text-lg font-bold text-white">Create Task</h2>
            </div>
            <button
              onClick={() => { resetForm(); onClose(); }}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Title */}
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-[#344054]">TASK TITLE</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Design new landing page"
              className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#EAECF0] rounded-xl text-sm focus:ring-2 focus:ring-[#155DFC]/20 focus:outline-none transition-all"
              autoFocus
            />
            {error && <p className="text-red-500 text-xs font-medium">{error}</p>}
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-[#344054]">PRIORITY</label>
            <div className="flex gap-2 flex-wrap">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPriority(opt.value)}
                  className={`px-3 py-1.5 rounded-lg border text-[12px] font-bold transition-all ${
                    priority === opt.value
                      ? `${opt.color} ring-2 ring-[#155DFC]/30`
                      : 'bg-white text-[#667085] border-[#EAECF0] hover:bg-[#F9FAFB]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Story Points (Fibonacci) */}
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-[#344054] flex items-center gap-2">
              <Hash size={14} className="text-[#98A2B3]" /> STORY POINTS
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {FIBONACCI.map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() => setStoryPoint(pt)}
                  className={`h-8 w-8 rounded-lg border text-[12px] font-bold transition-all ${
                    storyPoint === pt
                      ? 'bg-[#155DFC] text-white border-[#155DFC]'
                      : 'bg-white text-[#667085] border-[#EAECF0] hover:bg-[#F9FAFB]'
                  }`}
                >
                  {pt}
                </button>
              ))}
            </div>
          </div>

          {/* Assignee */}
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-[#344054] flex items-center gap-2">
              <User size={14} className="text-[#98A2B3]" /> ASSIGNEE
            </label>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value ? parseInt(e.target.value, 10) : '')}
              className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#EAECF0] rounded-xl text-sm text-[#475467] focus:ring-2 focus:ring-[#155DFC]/20 focus:outline-none transition-all appearance-none"
              disabled={loadingMembers}
            >
              <option value="">Select Assignee (optional)</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={() => { resetForm(); onClose(); }}
              className="flex-1 px-4 py-3 border border-[#EAECF0] text-[#344054] rounded-xl font-bold text-sm hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-[#155DFC] text-white rounded-xl font-bold text-sm hover:bg-[#1149C9] shadow-md transition-all disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}