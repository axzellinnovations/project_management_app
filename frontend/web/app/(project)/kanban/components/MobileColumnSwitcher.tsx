'use client';

import React from 'react';
import { KanbanColumn as KanbanColumnType, KanbanColumnConfig } from '../types';

interface MobileColumnSwitcherProps {
  columnConfigs: KanbanColumnConfig[];
  columns: KanbanColumnType[];
  activeMobileColumn: string;
  setActiveMobileColumn: (status: string) => void;
}

export default function MobileColumnSwitcher({
  columnConfigs,
  columns,
  activeMobileColumn,
  setActiveMobileColumn,
}: MobileColumnSwitcherProps) {
  return (
    <div className="md:hidden flex overflow-x-auto no-scrollbar gap-1 mb-3 bg-white rounded-xl p-1 border border-gray-100 shadow-sm">
      {columnConfigs.filter(col => col && col.status).map((col) => (
        <button
          key={col.status}
          onClick={() => setActiveMobileColumn(col.status)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${activeMobileColumn === col.status
              ? 'bg-[#155DFC] text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-800'
            }`}
        >
          {col.title}
          <span className={`ml-1.5 text-[10px] rounded-full px-1.5 py-0.5 ${activeMobileColumn === col.status ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
            }`}>
            {columns.find(c => c.status === col.status)?.tasks.length ?? 0}
          </span>
        </button>
      ))}
    </div>
  );
}
