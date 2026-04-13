'use client';
import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import SidebarField from './SidebarField';

const PRIORITY_CONFIG: Record<string, { text: string; bg: string; hover: string; dot: string }> = {
  URGENT: { text: 'text-red-600',    bg: 'bg-red-50',    hover: 'hover:bg-red-100',    dot: 'bg-red-500' },
  HIGH:   { text: 'text-orange-600', bg: 'bg-orange-50', hover: 'hover:bg-orange-100', dot: 'bg-orange-500' },
  MEDIUM: { text: 'text-amber-600',  bg: 'bg-amber-50',  hover: 'hover:bg-amber-100',  dot: 'bg-amber-400' },
  LOW:    { text: 'text-gray-500',   bg: 'bg-gray-100',  hover: 'hover:bg-gray-200',   dot: 'bg-gray-400' },
};

const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

interface PrioritySectionProps {
  priority: string;
  onUpdatePriority?: (priority: string) => void;
}

const PrioritySection: React.FC<PrioritySectionProps> = ({ priority, onUpdatePriority }) => {
  const [isOpen, setIsOpen] = useState(false);
  const cfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.LOW;

  useEffect(() => {
    if (!isOpen) return;
    const close = () => setIsOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [isOpen]);

  if (!priority) return null;

  return (
    <SidebarField label="Priority">
      <div className="relative">
        <div
          aria-disabled={!onUpdatePriority}
          onClick={(e) => { e.stopPropagation(); setIsOpen((v) => !v); }}
          className={`flex items-center gap-2 text-sm font-semibold px-2 py-1 min-h-[44px] sm:min-h-0 rounded w-fit cursor-pointer transition-colors ${cfg.text} ${cfg.bg} ${cfg.hover} ${!onUpdatePriority ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
          {priority}
          <ChevronDown size={12} className="opacity-60" />
        </div>
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[130px] overflow-hidden">
            {PRIORITY_OPTIONS.map((option) => {
              const c = PRIORITY_CONFIG[option] ?? PRIORITY_CONFIG.LOW;
              return (
                <button
                  key={option}
                  onClick={(e) => { e.stopPropagation(); onUpdatePriority?.(option); setIsOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm border-b border-gray-50 last:border-b-0 flex items-center gap-2 transition-colors ${c.hover} ${c.text} font-medium`}
                >
                  <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                  {option}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </SidebarField>
  );
};

export default PrioritySection;
