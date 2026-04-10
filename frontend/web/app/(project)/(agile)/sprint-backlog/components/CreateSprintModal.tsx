'use client';

import React, { useState } from 'react';
import { X, Rocket, Calendar, Target } from 'lucide-react';

interface CreateSprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateSprint: (name: string, startDate?: string, endDate?: string, goal?: string) => Promise<void>;
  defaultName: string;
}

export default function CreateSprintModal({
  isOpen,
  onClose,
  onCreateSprint,
  defaultName,
}: CreateSprintModalProps) {
  const [name, setName] = useState(defaultName);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [goal, setGoal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync default name when modal opens
  React.useEffect(() => {
    if (isOpen) setName(defaultName);
  }, [isOpen, defaultName]);

  const resetForm = () => {
    setName(defaultName);
    setStartDate('');
    setEndDate('');
    setGoal('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Sprint name is required');
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setError('End date must be on or after start date');
      return;
    }

    setSubmitting(true);
    try {
      await onCreateSprint(name.trim(), startDate || undefined, endDate || undefined, goal.trim() || undefined);
      resetForm();
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message || 'Failed to create sprint.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#00000040] z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="relative bg-[#155DFC] px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white">
                <Rocket size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Create New Sprint</h2>
                <p className="text-white/70 text-[11px] font-medium uppercase tracking-wider">Scrum Planning</p>
              </div>
            </div>
            <button
              onClick={() => { resetForm(); onClose(); }}
              className="absolute right-4 top-4 p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white"
            >
              <X size={20} />
            </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Sprint Name */}
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-[#344054]">SPRINT NAME</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sprint 1"
              className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#EAECF0] rounded-xl text-sm focus:ring-2 focus:ring-[#155DFC]/20 focus:outline-none transition-all font-medium"
              autoFocus
            />
            {error && <p className="text-red-500 text-xs font-medium">{error}</p>}
          </div>

          {/* Dates Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-[#344054] flex items-center gap-2">
                <Calendar size={14} className="text-[#98A2B3]" /> START DATE
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#EAECF0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#155DFC]/20 transition-all cursor-pointer"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-[#344054] flex items-center gap-2">
                <Calendar size={14} className="text-[#98A2B3]" /> END DATE
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#EAECF0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#155DFC]/20 transition-all cursor-pointer"
              />
            </div>
          </div>

          {/* Sprint Goal */}
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-[#344054] flex items-center gap-2">
              <Target size={14} className="text-[#98A2B3]" /> SPRINT GOAL
            </label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What do we want to achieve in this sprint?"
              rows={3}
              className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#EAECF0] rounded-xl text-sm focus:ring-2 focus:ring-[#155DFC]/20 focus:outline-none transition-all resize-none font-medium"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={() => { resetForm(); onClose(); }}
              className="flex-1 px-4 py-3 border border-[#EAECF0] text-[#344054] rounded-xl font-bold text-sm hover:bg-gray-50 transition-all active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-[#155DFC] text-white rounded-xl font-bold text-sm hover:bg-[#1149C9] shadow-md transition-all disabled:opacity-50 active:scale-[0.98]"
            >
              {submitting ? 'Creating...' : 'Create Sprint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
