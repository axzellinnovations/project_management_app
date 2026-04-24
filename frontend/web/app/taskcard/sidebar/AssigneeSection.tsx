'use client';
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { getOrFetchUserMap } from './userMapCache';
import SidebarField from './SidebarField';

interface AssigneeSectionProps {
  assignee: string | null;
  onUnassign?: () => void;
}

const AssigneeSection: React.FC<AssigneeSectionProps> = ({ assignee, onUnassign }) => {
  const [usersMap, setUsersMap] = useState<Record<string, string | null>>({});

  useEffect(() => {
    // getOrFetchUserMap is a module-level singleton — this call is free after the first task card opens
    void getOrFetchUserMap().then(setUsersMap);
  }, []);

  if (!assignee) return null;

  const picUrl = usersMap[assignee] ?? '';

  return (
    <SidebarField label="Assignee">
      <div className="flex items-center gap-2 hover:bg-gray-50 p-1 min-h-[44px] sm:min-h-0 -ml-1 rounded group">
        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold overflow-hidden">
          {picUrl ? (
            <Image src={picUrl} alt={assignee} width={24} height={24} className="w-full h-full object-cover" unoptimized />
          ) : (
            assignee.charAt(0).toUpperCase()
          )}
        </div>
        <span className="text-sm text-blue-600 flex-1">{assignee}</span>
        {onUnassign && (
          <button
            onClick={onUnassign}
            title="Remove assignee"
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </SidebarField>
  );
};

export default AssigneeSection;
