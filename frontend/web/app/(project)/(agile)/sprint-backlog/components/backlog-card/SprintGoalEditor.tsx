'use client';

import { Pencil } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface SprintGoalEditorProps {
  goalText: string;
  editingGoal: boolean;
  savingGoal: boolean;
  sprintGoal: string;
  onGoalTextChange: (text: string) => void;
  onStartEditing: () => void;
  onSave: () => void;
  onCancel: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function SprintGoalEditor({
  goalText,
  editingGoal,
  savingGoal,
  sprintGoal,
  onGoalTextChange,
  onStartEditing,
  onSave,
  onCancel,
}: SprintGoalEditorProps) {
  if (editingGoal) {
    return (
      <div className="mb-3 px-1">
        <div className="flex items-start gap-2">
          <textarea
            value={goalText}
            onChange={(e) => onGoalTextChange(e.target.value)}
            placeholder="Define the sprint goal..."
            className="flex-1 rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-[13px] text-[#344054] placeholder:text-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#155DFC]/20 focus:border-[#155DFC] resize-none"
            rows={2}
            maxLength={500}
          />
          <button
            onClick={onSave}
            disabled={savingGoal}
            className="rounded-lg bg-[#155DFC] px-3 py-2 text-[12px] font-bold text-white hover:bg-[#1149C9] disabled:opacity-50 transition-colors"
          >
            {savingGoal ? '...' : 'Save'}
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg border border-[#D0D5DD] px-3 py-2 text-[12px] font-bold text-[#344054] hover:bg-[#F2F4F7] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3 px-1">
      <button
        type="button"
        onClick={onStartEditing}
        className="group flex items-center gap-2 text-[13px] text-[#667085] hover:text-[#344054] transition-colors"
      >
        <span className="font-medium">Goal:</span>
        <span className={goalText ? 'text-[#344054]' : 'italic'}>
          {goalText || 'Click to set a sprint goal...'}
        </span>
        <Pencil size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    </div>
  );
}
