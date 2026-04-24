'use client';
import React, { useEffect, useState } from 'react';
import { Flag, ChevronDown, X } from 'lucide-react';
import { getMilestones, createMilestone } from '@/services/milestone-service';
import type { MilestoneResponse } from '@/types';
import SidebarField from './SidebarField';

interface MilestoneSectionProps {
  projectId?: number;
  milestoneId?: number | null;
  milestoneName?: string | null;
  onUpdateMilestone?: (milestoneId: number | null) => void;
}

const MilestoneSection: React.FC<MilestoneSectionProps> = ({
  projectId, milestoneId, milestoneName, onUpdateMilestone,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [milestones, setMilestones] = useState<MilestoneResponse[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (!projectId) return;
    getMilestones(projectId).then(setMilestones).catch(() => setMilestones([]));
  }, [projectId]);

  useEffect(() => {
    if (!isOpen) return;
    // Document-level click closes the dropdown when the user clicks anywhere outside it
    const close = () => setIsOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [isOpen]);

  const handleSelect = (id: number | null) => {
    onUpdateMilestone?.(id);
    setIsOpen(false);
    setShowCreate(false);
  };

  const handleCreate = async () => {
    if (!projectId || !newName.trim()) return;
    try {
      const created = await createMilestone(projectId, { name: newName.trim() });
      setMilestones((prev) => [...prev, created]);
      handleSelect(created.id);
      setNewName('');
    } catch {
      // ignore
    }
  };

  return (
    <SidebarField label="Milestone">
      <div className="relative">
        <button
          onClick={(e) => { e.stopPropagation(); setIsOpen((v) => !v); }}
          className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200 w-full text-left transition-all"
        >
          <Flag size={14} className={milestoneId ? 'text-purple-500' : 'text-gray-400'} />
          <span className={milestoneId ? 'text-gray-800' : 'text-gray-400 italic'}>
            {milestoneName ?? 'No milestone'}
          </span>
          <ChevronDown size={12} className="ml-auto text-gray-400 opacity-60" />
        </button>
        {isOpen && (
          <div
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {milestoneId && (
              <button
                onClick={() => handleSelect(null)}
                className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2"
              >
                <X size={12} /> Clear milestone
              </button>
            )}
            {milestones.map((m) => (
              <button
                key={m.id}
                onClick={() => handleSelect(m.id)}
                className={`w-full text-left px-3 py-2 text-sm border-b border-gray-50 last:border-b-0 flex items-center gap-2 transition-colors hover:bg-purple-50 ${m.id === milestoneId ? 'text-purple-700 font-medium' : 'text-gray-700'}`}
              >
                <Flag size={12} className="text-purple-400 shrink-0" />
                {m.name}
              </button>
            ))}
            {!showCreate ? (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
              >
                + Create milestone
              </button>
            ) : (
              <div className="p-2 border-t border-gray-100">
                <input
                  autoFocus
                  type="text"
                  placeholder="Milestone name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleCreate();
                    if (e.key === 'Escape') setShowCreate(false);
                  }}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500 mb-2"
                />
                <div className="flex gap-1">
                  <button
                    onClick={() => void handleCreate()}
                    className="flex-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => { setShowCreate(false); setNewName(''); }}
                    className="flex-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </SidebarField>
  );
};

export default MilestoneSection;
