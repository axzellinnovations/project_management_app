'use client';
import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; badge: string; dot: string }> = {
  TODO:        { label: 'To Do',       badge: 'bg-gray-100 text-gray-700',  dot: 'bg-gray-400' },
  IN_PROGRESS: { label: 'In Progress', badge: 'bg-blue-50 text-blue-700',   dot: 'bg-blue-500' },
  IN_REVIEW:   { label: 'In Review',   badge: 'bg-amber-50 text-amber-700', dot: 'bg-amber-400' },
  DONE:        { label: 'Done',        badge: 'bg-green-50 text-green-700', dot: 'bg-green-500' },
};

const STATUS_OPTIONS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const;

interface StatusSectionProps {
  status: string;
  onUpdateStatus?: (status: string) => void;
}

const StatusSection: React.FC<StatusSectionProps> = ({ status, onUpdateStatus }) => {
  const [isOpen, setIsOpen] = useState(false);
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.TODO;

  useEffect(() => {
    if (!isOpen) return;
    const close = () => setIsOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [isOpen]);

  return (
    <div className="mb-6">
      <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block tracking-wide">Status</label>
      <div className="relative">
        <button
          onClick={(e) => { e.stopPropagation(); setIsOpen((v) => !v); }}
          className={`w-full flex items-center justify-between px-3 py-2 border rounded text-sm font-semibold transition-colors shadow-sm ${cfg.badge} border-transparent hover:opacity-80`}
        >
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
            <span>{cfg.label}</span>
          </div>
          <ChevronDown size={16} className="opacity-60" />
        </button>
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
            {STATUS_OPTIONS.map((option) => {
              const s = STATUS_CONFIG[option] ?? STATUS_CONFIG.TODO;
              return (
                <button
                  key={option}
                  onClick={(e) => { e.stopPropagation(); onUpdateStatus?.(option); setIsOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm border-b border-gray-50 last:border-b-0 flex items-center gap-2 transition-colors hover:opacity-80 font-medium ${s.badge}`}
                >
                  <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                  {s.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatusSection;
