'use client';

import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { X, Calendar, User } from 'lucide-react';
import { Task } from '../types';
import { fetchProject, fetchTeamMembers } from '../api';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTask: (taskData: Partial<Task>) => Promise<void>;
  columnStatus: string;
  projectId: number;
  loading?: boolean;
}

export default function CreateTaskModal({
  isOpen,
  onClose,
  onCreateTask,
  columnStatus,
  projectId,
  loading = false,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [assignee, setAssignee] = useState<number | ''>('');
  const [teamMembers, setTeamMembers] = useState<{ id: number; name: string }[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const safeTeamMembers = Array.isArray(teamMembers) ? teamMembers : [];

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
      status: columnStatus,
      projectId,
      startDate: startDate ? startDate.toISOString().split('T')[0] : undefined,
      dueDate: dueDate ? dueDate.toISOString().split('T')[0] : undefined,
      assigneeId: assignee || undefined,
    };

    console.log('Submitting task with data:', {
      projectId,
      columnStatus,
      taskData,
      assigneeId: assignee,
    });

    try {
      await onCreateTask(taskData);
      setTitle('');
      setStartDate(null);
      setDueDate(null);
      setAssignee('');
      onClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to create task. Please try again.'
      );
      console.error('Task creation error:', err);
    }
  };

  // fetch team members when modal opens
  useEffect(() => {
    if (!isOpen) return;
    if (!projectId) return;

    const loadMembers = async () => {
      setLoadingMembers(true);
      try {
        const project = await fetchProject(projectId);
        if (project.teamId) {
          const members = await fetchTeamMembers(project.teamId);
          setTeamMembers(members || []);
        } else {
          setTeamMembers([]);
        }
      } catch (err) {
        console.error('Failed to load team members:', err);
        setTeamMembers([]); // Set empty array on error
      } finally {
        setLoadingMembers(false);
      }
    };

    loadMembers();
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">What needs to be done?</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Title Field */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
              disabled={loading}
              autoFocus
            />
            {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
          </div>

          {/* Start Date */}
          <div className="flex items-center gap-3">
            <Calendar size={18} className="text-gray-400 flex-shrink-0" />
            <DatePicker
              selected={startDate}
              onChange={(date: Date | null) => setStartDate(date)}
              dateFormat="MMM d, yyyy"
              minDate={new Date(2020, 0, 1)}
              maxDate={new Date(2030, 11, 31)}
              placeholderText="Select start date"
              wrapperClassName="flex-1"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
              disabled={loading}
            />
          </div>

          {/* Due Date */}
          <div className="flex items-center gap-3">
            <Calendar size={18} className="text-gray-400 flex-shrink-0" />
            <DatePicker
              selected={dueDate}
              onChange={(date: Date | null) => setDueDate(date)}
              dateFormat="MMM d, yyyy"
              minDate={startDate || new Date(2020, 0, 1)}
              maxDate={new Date(2030, 11, 31)}
              placeholderText="Select due date"
              wrapperClassName="flex-1"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
              disabled={loading}
            />
          </div>

          {/* Assignee */}
          <div className="flex items-center gap-3">
            <User size={18} className="text-gray-400 flex-shrink-0" />
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value ? parseInt(e.target.value, 10) : '')}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
              disabled={loading || loadingMembers}
            >
              <option value="">Unassigned</option>
              {safeTeamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
            {loadingMembers && (
              <p className="text-gray-500 text-xs mt-1">Loading members...</p>
            )}
          </div>

          {/* Error Message */}
          {submitError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
              {submitError}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:bg-gray-400"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
