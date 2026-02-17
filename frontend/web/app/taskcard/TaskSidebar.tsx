"use client";
import React from 'react';
import { ChevronDown, ArrowRight } from 'lucide-react';

interface TaskSidebarProps {
  status: string;
  assignee: string;
  reporter: string;
  labels: string[];
  priority: string;
  sprint: string;
  storyPoint: number;
  dates: {
    created: string;
    updated: string;
    dueDate: string;
  };
}

const TaskSidebar: React.FC<TaskSidebarProps> = ({ 
  status, assignee, reporter, labels, priority, sprint, storyPoint, dates 
}) => {
  return (
    <div className="w-80 bg-gray-50/50 p-6 overflow-y-auto border-l border-gray-100 flex-shrink-0 scrollbar-thin">
      
      {/* Status Dropdown */}
      <div className="mb-6">
        <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block tracking-wide">Status</label>
        <button className="w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-300 text-gray-800 font-semibold text-sm rounded hover:bg-gray-50 transition-colors shadow-sm uppercase">
          <span>{status}</span>
          <ChevronDown size={16} className="text-gray-500" />
        </button>
      </div>

      {/* Details Group */}
      <div className="border rounded-md border-gray-200 bg-white mb-6 shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm text-gray-700">
          Details
        </div>
        
        <div className="p-4 space-y-5">
          
          <SidebarField label="Assignee">
             <div className="flex items-center gap-2 hover:bg-gray-50 p-1 -ml-1 rounded cursor-pointer group">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                    {assignee.charAt(0)}
                </div>
                <span className="text-sm text-blue-600 group-hover:underline">{assignee}</span>
             </div>
          </SidebarField>

          <SidebarField label="Reporter">
            <div className="flex items-center gap-2 hover:bg-gray-50 p-1 -ml-1 rounded cursor-pointer group">
                <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold">
                    {reporter.charAt(0)}
                </div>
                <span className="text-sm text-blue-600 group-hover:underline">{reporter}</span>
             </div>
          </SidebarField>

          <SidebarField label="Labels">
            <div className="flex flex-wrap gap-2">
              {labels.map(label => (
                <span key={label} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200 cursor-pointer transition-colors">
                  {label}
                </span>
              ))}
              <button className="text-xs text-gray-400 hover:text-gray-600 transition-colors">+ Add</button>
            </div>
          </SidebarField>

          <SidebarField label="Sprint">
            <span className="text-sm text-blue-600 hover:underline cursor-pointer">{sprint}</span>
          </SidebarField>

          <SidebarField label="Story Points">
            <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2 py-1 rounded-full inline-block">
                {storyPoint}
            </span>
          </SidebarField>

          <SidebarField label="Priority">
            <div className="flex items-center gap-2 text-red-600 text-sm font-medium bg-red-50 px-2 py-1 rounded w-fit">
               <ArrowRight size={14} className="-rotate-45" />
               {priority}
            </div>
          </SidebarField>

        </div>
      </div>

      {/* Dates Group */}
      <div className="border rounded-md border-gray-200 bg-white shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm text-gray-700">
          Dates
        </div>
        <div className="p-4 space-y-4">
           <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">Due date</span>
              <span className="text-sm text-gray-800 bg-gray-50 px-2 py-1 rounded border border-gray-100">{dates.dueDate}</span>
           </div>
           <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500 font-medium">Created</span>
              <span className="text-xs text-gray-600">{dates.created}</span>
           </div>
           <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500 font-medium">Updated</span>
              <span className="text-xs text-gray-600">{dates.updated}</span>
           </div>
        </div>
      </div>

      <div className="mt-8 text-xs text-gray-400 flex justify-between px-1">
        <button className="hover:text-gray-600">Configure fields</button>
        <button className="hover:text-gray-600">Plain Text</button>
      </div>

    </div>
  );
};

// Helper for Sidebar rows
const SidebarField = ({ label, children }: { label: string, children: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <span className="text-xs text-gray-500 font-medium">{label}</span>
    {children}
  </div>
);

export default TaskSidebar;