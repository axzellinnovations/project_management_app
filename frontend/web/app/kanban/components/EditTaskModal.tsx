'use client';

import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { X, Calendar, User, Edit2 } from 'lucide-react';
import { Task } from '../types';
import { fetchProject, fetchTeamMembers, TeamMemberOption } from '../api';

interface EditTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateTask: (taskId: number, taskData: Partial<Task>) => Promise<void>;
  task: Task | null;
  loading?: boolean;
}

export default function EditTaskModal({
  isOpen,
  onClose,
  onUpdateTask,
  task,
  loading = false,
}: EditTaskModalProps) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [assignee, setAssignee] = useState<number | ''>('');
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const safeTeamMembers = Array.isArray(teamMembers) ? teamMembers : [];

  // Initialize form when task changes
  useEffect(() => {
    if (task && isOpen) {
      setTitle(task.title || '');
      setDueDate(task.dueDate ? new Date(task.dueDate) : null);
      setAssignee(task.assigneeId || '');
      setError(null);
      setSubmitError(null);
    }
  }, [task, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitError(null);

    if (!title.trim()) {
      setError('Task name is required');
      return;
    }

    const taskData: Partial<Task> = {
      title: title.trim(),
      dueDate: dueDate ? dueDate.toISOString().split('T')[0] : undefined,
      assigneeId: assignee || undefined,
    };

    try {
      if (task) {
        await onUpdateTask(task.id, taskData);
        onClose();
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to update task. Please try again.'
      );
      console.error('Task update error:', err);
    }
  };

  // fetch team members when modal opens
  useEffect(() => {
    if (!isOpen || !task) return;

    const loadMembers = async () => {
      setLoadingMembers(true);
      try {
        const project = await fetchProject(task.projectId || 0);
        if (project.teamId) {
          const members = await fetchTeamMembers(project.teamId);
          setTeamMembers(members || []);
        } else {
          setTeamMembers([]);
        }
      } catch (err) {
        console.error('Failed to load team members:', err);
        setTeamMembers([]);
      } finally {
        setLoadingMembers(false);
      }
    };

    loadMembers();
  }, [isOpen, task]);

  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                <Edit2 size={20} className="text-white" />
              </div>
              <h2 className="text-xl font-semibold text-white">Edit Task</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center text-white hover:bg-opacity-30 transition-all duration-200"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <div className="w-5 h-5 bg-blue-100 rounded flex items-center justify-center">
                <span className="text-blue-600 text-xs font-bold">T</span>
              </div>
              Task Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm transition-all duration-200"
              disabled={loading}
            />
            {error && (
              <p className="text-red-600 text-xs flex items-center gap-1">
                <span className="w-4 h-4 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 text-xs">!</span>
                </span>
                {error}
              </p>
            )}
          </div>



          {/* Due Date Section */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Calendar size={16} className="text-gray-500" />
              Due Date
              <span className="text-xs text-gray-400 font-normal">(Optional)</span>
            </label>

            <button
              type="button"
              onClick={() => setShowDueDatePicker(!showDueDatePicker)}
              className={`w-full flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all duration-200 ${
                dueDate
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-gray-100'
              }`}
              disabled={loading}
            >
              <Calendar size={16} />
              {dueDate ? (
                <span className="text-sm font-medium">
                  {dueDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              ) : (
                <span className="text-sm">Set due date</span>
              )}
            </button>

            {showDueDatePicker && (
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <DatePicker
                  selected={dueDate}
                  onChange={(date: Date | null) => {
                    setDueDate(date);
                    setShowDueDatePicker(false);
                  }}
                  dateFormat="MMM d, yyyy"
                  inline
                  disabled={loading}
                />
              </div>
            )}
          </div>

          {/* Assignee Section */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <User size={16} className="text-gray-500" />
              Assignee
              <span className="text-xs text-gray-400 font-normal">(Optional)</span>
            </label>

            <div className="relative">
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value ? parseInt(e.target.value, 10) : '')}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm bg-white transition-all duration-200 appearance-none"
                disabled={loading || loadingMembers}
              >
                <option value="">Unassigned</option>
                {safeTeamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}{member.role ? ` (${member.role})` : ''}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {loadingMembers && (
              <div className="text-gray-500 text-xs flex items-center gap-2">
                <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                Loading team members...
              </div>
            )}
          </div>

          {/* Error Message */}
          {submitError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3">
              <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-red-600 text-xs font-bold">!</span>
              </div>
              <div>
                <p className="font-medium">Error updating task</p>
                <p className="text-xs mt-1">{submitError}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-50 transition-all duration-200"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium text-sm hover:from-blue-600 hover:to-blue-700 transition-all duration-200 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin"></div>
                  Updating...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Edit2 size={16} />
                  Update Task
                </div>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
