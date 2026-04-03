'use client';

import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { X, Calendar, User, Plus } from 'lucide-react';
import axios from '@/lib/axios';
import { AxiosError } from 'axios';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTask: (taskData: Record<string, unknown>) => Promise<void>;
  columnStatus: string;
  projectId: number;
  sprintId?: number;
  loading?: boolean;
}

export default function CreateTaskModal({
  isOpen,
  onClose,
  onCreateTask,
  columnStatus,
  projectId,
  sprintId,
  loading = false,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [assignee, setAssignee] = useState<number | ''>('');
  const [teamMembers, setTeamMembers] = useState<{ id: number; name: string }[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitError(null);

    if (!title.trim()) {
      setError('Task name is required');
      return;
    }

    const todayIso = new Date().toISOString().split('T')[0];

    const taskData = {
      title: title.trim(),
      status: columnStatus,
      projectId,
      sprintId,
      startDate: todayIso,
      dueDate: dueDate ? dueDate.toISOString().split('T')[0] : todayIso,
      assigneeId: assignee || undefined,
      description: '',
      priority: 'MEDIUM',
      storyPoint: 0
    };

    try {
      await onCreateTask(taskData);
      setTitle('');
      setDueDate(null);
      setAssignee('');
      setShowDatePicker(false);
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      setSubmitError(axiosErr?.response?.data?.message || 'Failed to create task.');
      console.error('Task creation error:', err);
    }
  };

  useEffect(() => {
    if (!isOpen || !projectId) return;

    const loadMembers = async () => {
      setLoadingMembers(true);
      try {
        const projectRes = await axios.get(`/api/projects/${projectId}`);
        const project = projectRes.data;
        if (project.team?.id) {
          const membersRes = await axios.get(`/api/teams/${project.team.id}/members`);
          const payload = membersRes.data;

          const rawMembers = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.members)
              ? payload.members
              : Array.isArray(payload?.data)
                ? payload.data
                : Array.isArray(payload?.content)
                  ? payload.content
                  : [];

          setTeamMembers(rawMembers.map((m: { id: number; name?: string; username?: string; fullName?: string; user?: { fullName?: string; username?: string } }) => ({
              id: m.id,
              name: m.name ?? m.username ?? m.fullName ?? m.user?.fullName ?? m.user?.username ?? 'Unknown'
          })));
        }
      } catch (err) {
        console.error('Failed to load team members:', err);
      } finally {
        setLoadingMembers(false);
      }
    };

    loadMembers();
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#00000040] z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        <div className="bg-[#155DFC] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Plus size={20} className="text-white" />
              <h2 className="text-lg font-bold text-white">Create Sprint Task</h2>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white">
              <X size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
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

          <div className="space-y-2">
            <label className="text-[13px] font-bold text-[#344054] flex items-center gap-2">
              <Calendar size={14} className="text-[#98A2B3]" /> DUE DATE
            </label>
            <button
                type="button"
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="w-full text-left px-4 py-3 bg-[#F9FAFB] border border-[#EAECF0] rounded-xl text-sm text-[#475467] hover:bg-gray-50 flex items-center justify-between"
            >
                {dueDate ? dueDate.toLocaleDateString() : 'Set due date (optional)'}
                <Calendar size={16} className="text-[#98A2B3]" />
            </button>
            {showDatePicker && (
                <div className="absolute z-[110] bg-white border border-[#EAECF0] rounded-xl shadow-xl p-2 mt-1">
                     <DatePicker
                        selected={dueDate}
                        onChange={(date: Date | null) => {
                            setDueDate(date);
                            setShowDatePicker(false);
                        }}
                        inline
                    />
                </div>
            )}
          </div>

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
                {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          {submitError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">{submitError}</div>}

          <div className="flex gap-3 pt-3">
             <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-[#EAECF0] text-[#344054] rounded-xl font-bold text-sm hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-[#155DFC] text-white rounded-xl font-bold text-sm hover:bg-[#1149C9] shadow-md transition-all disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
