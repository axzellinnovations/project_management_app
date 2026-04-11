'use client';
import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import type { MilestoneResponse } from '@/types';
import { STATUS_CONFIG, type MilestoneStatus } from './milestoneConfig';

export interface MilestoneFormData {
  name: string;
  description: string;
  dueDate: string;
  status: MilestoneStatus;
}

interface MilestoneFormProps {
  initial?: Partial<MilestoneResponse>;
  onSubmit: (data: MilestoneFormData) => void;
  onCancel: () => void;
}

const MilestoneForm: React.FC<MilestoneFormProps> = ({ initial, onSubmit, onCancel }) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [dueDate, setDueDate] = useState(initial?.dueDate?.substring(0, 10) ?? '');
  const [status, setStatus] = useState<MilestoneStatus>((initial?.status as MilestoneStatus) ?? 'OPEN');

  return (
    <div className="bg-white rounded-xl border border-blue-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">{initial?.id ? 'Edit Milestone' : 'New Milestone'}</h3>
      <div className="space-y-3">
        <input
          autoFocus
          type="text"
          placeholder="Milestone name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        />
        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-y"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <div className="flex-1">
            <label className="text-xs text-gray-500 font-medium mb-1 block">Due date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 h-11 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 font-medium mb-1 block">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as MilestoneStatus)}
              className="w-full border border-gray-300 rounded-lg px-3 h-11 text-sm focus:outline-none focus:border-blue-500 bg-white"
            >
              {(Object.keys(STATUS_CONFIG) as MilestoneStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm hover:bg-gray-200 transition-colors w-full sm:w-auto justify-center"
        >
          <X size={13} /> Cancel
        </button>
        <button
          onClick={() => name.trim() && onSubmit({ name: name.trim(), description, dueDate, status })}
          disabled={!name.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto justify-center"
        >
          <Check size={13} /> {initial?.id ? 'Save' : 'Create'}
        </button>
      </div>
    </div>
  );
};

export default MilestoneForm;
