'use client';
import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { Plus, X } from 'lucide-react';
import api from '@/lib/axios';
import SidebarField from './SidebarField';

interface AssigneeRow {
  memberId: number;
  userId: number;
  name: string;
  photoUrl: string | null;
}

interface MultiAssigneeSectionProps {
  taskId: number;
  projectId?: number;
  assignees: AssigneeRow[];
  onChanged: () => void;
  readOnly?: boolean;
}

const MultiAssigneeSection: React.FC<MultiAssigneeSectionProps> = ({
  taskId,
  projectId,
  assignees,
  onChanged,
  readOnly = false,
}) => {
  const [members, setMembers] = useState<{ memberId: number; userId: number; name: string; photoUrl: string | null }[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Lazy-load members only when the dropdown opens — avoids an API call for every task card that renders
    if (!projectId || !open) return;
    api.get(`/api/projects/${projectId}/members`).then((res) => {
      setMembers(
        (res.data as { id: number; user: { userId: number; username: string; profilePicUrl?: string } }[]).map((m) => ({
          memberId: m.id,
          userId: m.user.userId,
          name: m.user.username,
          photoUrl: m.user.profilePicUrl ?? null,
        }))
      );
    }).catch(() => {});
  }, [projectId, open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentIds = new Set(assignees.map((a) => a.memberId));

  const addAssignee = async (memberId: number) => {
    if (readOnly) return;
    const member = members.find((m) => m.memberId === memberId);
    if (!member) return;
    const updated = [...assignees.map((a) => a.userId), member.userId];
    await api.patch(`/api/tasks/${taskId}/assignees`, { assigneeIds: updated });
    onChanged();
    setOpen(false);
  };

  const removeAssignee = async (memberId: number) => {
    if (readOnly) return;
    const updated = assignees.filter((a) => a.memberId !== memberId).map((a) => a.userId);
    await api.patch(`/api/tasks/${taskId}/assignees`, { assigneeIds: updated });
    onChanged();
  };

  return (
    <SidebarField label="Assignees">
      <div className="space-y-1" ref={ref}>
        {assignees.length === 0 && (
          <span className="text-xs text-gray-400 italic">No assignees</span>
        )}
        {assignees.map((a) => (
          <div
            key={a.memberId}
            className="flex items-center gap-2 hover:bg-gray-50 p-1 min-h-[44px] sm:min-h-0 -ml-1 rounded group"
          >
            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold overflow-hidden flex-shrink-0">
              {a.photoUrl ? (
                <Image src={a.photoUrl} alt={a.name} width={24} height={24} className="w-full h-full object-cover" unoptimized />
              ) : (
                a.name.charAt(0).toUpperCase()
              )}
            </div>
            <span className="text-sm text-blue-600 flex-1 truncate">{a.name}</span>
            <button
              onClick={() => removeAssignee(a.memberId)}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all"
              title="Remove assignee"
            >
              <X size={14} />
            </button>
          </div>
        ))}

        {/* Add assignee button */}
        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            disabled={readOnly}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 mt-1 px-1 py-0.5 rounded hover:bg-gray-50 min-h-[44px] sm:min-h-0"
          >
            <Plus size={13} />
            Add assignee
          </button>

          {open && (
            <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 max-h-52 overflow-y-auto">
              {members.filter((m) => !currentIds.has(m.memberId)).length === 0 && (
                <p className="text-xs text-gray-400 px-3 py-2">All members assigned</p>
              )}
              {members
                .filter((m) => !currentIds.has(m.memberId))
                .map((m) => (
                  <button
                    key={m.memberId}
                    onClick={() => addAssignee(m.memberId)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left"
                  >
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold overflow-hidden flex-shrink-0">
                      {m.photoUrl ? (
                        <Image src={m.photoUrl} alt={m.name} width={24} height={24} className="w-full h-full object-cover" unoptimized />
                      ) : (
                        m.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="truncate">{m.name}</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>
    </SidebarField>
  );
};

export default MultiAssigneeSection;
