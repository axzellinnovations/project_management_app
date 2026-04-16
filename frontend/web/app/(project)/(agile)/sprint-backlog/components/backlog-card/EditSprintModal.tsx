'use client';

import { useState } from 'react';
import { Pencil, X } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface EditSprintModalProps {
  open: boolean;
  sprintName: string;
  loading: boolean;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function EditSprintModal({ open, sprintName, loading, onConfirm, onCancel }: EditSprintModalProps) {
  const [name, setName] = useState(sprintName);
  const [prevName, setPrevName] = useState(sprintName);

  if (sprintName !== prevName) {
    setName(sprintName);
    setPrevName(sprintName);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(16, 24, 40, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl border border-[#E4E7EC] bg-white shadow-2xl"
        style={{ animation: 'confirmSlideIn 0.2s cubic-bezier(0.34,1.56,0.64,1) both' }}
      >
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-lg p-1 text-[#98A2B3] hover:text-[#344054] hover:bg-[#F2F4F7] transition-all duration-150"
        >
          <X size={16} />
        </button>

        <div className="p-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#B2DDFF] bg-[#EFF8FF] text-[#175CD3]">
            <Pencil size={20} />
          </div>
          <h3 className="text-[16px] font-bold text-[#101828] mb-1">Edit Sprint</h3>
          <p className="text-[13px] text-[#475467] mb-4">Update the sprint name.</p>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onConfirm(name.trim()); }}
            autoFocus
            className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2.5 text-[14px] text-[#101828] outline-none focus:border-[#175CD3] focus:ring-2 focus:ring-[#175CD3]/20 transition-all duration-150"
            placeholder="Sprint name..."
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-[#F2F4F7] px-6 py-4">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-[#D0D5DD] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#344054] hover:bg-[#F9FAFB] transition-all duration-150 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => { if (name.trim()) onConfirm(name.trim()); }}
            disabled={loading || !name.trim()}
            className="flex items-center gap-2 rounded-lg bg-[#175CD3] hover:bg-[#1849A9] px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
            Save Changes
          </button>
        </div>

        <style>{`
          @keyframes confirmSlideIn {
            from { opacity: 0; transform: scale(0.92) translateY(10px); }
            to   { opacity: 1; transform: scale(1)   translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
}
