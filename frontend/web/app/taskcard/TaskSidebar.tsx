"use client";
import React, { useState, useEffect } from 'react';
import { ChevronDown, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import api from '@/lib/axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

interface TaskSidebarProps {
  status: string;
  assignee: string | null;
  reporter: string | null;
  labels: string[];
  priority: string;
  sprint: string | null;
  storyPoint: number;
  dates: {
    created: string;
    updated: string;
    dueDate: string;
  };
  onUpdateStatus?: (status: string) => void;
  onUpdatePriority?: (priority: string) => void;
  onUpdateStoryPoint?: (storyPoint: number) => void;
}

const TaskSidebar: React.FC<TaskSidebarProps> = ({ 
  status, assignee, reporter, labels, priority, sprint, storyPoint, dates,
  onUpdateStatus, onUpdatePriority, onUpdateStoryPoint
}) => {
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const [isEditingStoryPoint, setIsEditingStoryPoint] = useState(false);
  const [editedStoryPoint, setEditedStoryPoint] = useState(storyPoint);
  const [usersMap, setUsersMap] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await api.get('/api/auth/users');
        const uidMap: Record<string, string | null> = {};
        response.data.forEach((u: any) => {
           if (u.username) uidMap[u.username] = u.profilePicUrl || null;
           if (u.fullName) uidMap[u.fullName] = u.profilePicUrl || null; // Map full name too in case assignee is full name
        });
        setUsersMap(uidMap);
      } catch (error) {
        console.error('Failed to fetch users:', error);
      }
    };
    void fetchUsers();
  }, []);

  const resolveProfilePic = (url?: string | null) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_BASE_URL}${url}`;
  };

  // Update local state when props change
  useEffect(() => {
    setEditedStoryPoint(storyPoint);
  }, [storyPoint]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setIsStatusOpen(false);
      setIsPriorityOpen(false);
    };

    if (isStatusOpen || isPriorityOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isStatusOpen, isPriorityOpen]);

  const statusOptions = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
  const priorityOptions = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

  const handleStatusChange = (newStatus: string) => {
    onUpdateStatus?.(newStatus);
    setIsStatusOpen(false);
  };

  const handlePriorityChange = (newPriority: string) => {
    onUpdatePriority?.(newPriority);
    setIsPriorityOpen(false);
  };

  const handleStoryPointSave = () => {
    if (editedStoryPoint !== storyPoint && editedStoryPoint >= 0) {
      onUpdateStoryPoint?.(editedStoryPoint);
    }
    setIsEditingStoryPoint(false);
  };

  return (
    <div className="w-80 bg-gray-50/50 p-6 overflow-y-auto border-l border-gray-100 flex-shrink-0 scrollbar-thin">
      
      {/* Status Dropdown */}
      <div className="mb-6">
        <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block tracking-wide">Status</label>
        <div className="relative">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsStatusOpen(!isStatusOpen);
            }}
            className="w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-300 text-gray-800 font-semibold text-sm rounded hover:bg-gray-50 transition-colors shadow-sm uppercase"
          >
            <span>{(status ?? 'TODO').replace('_', ' ')}</span>
            <ChevronDown size={16} className="text-gray-500" />
          </button>
          {isStatusOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-10">
              {statusOptions.map((option) => (
                <button
                  key={option}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusChange(option);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm text-gray-700 border-b border-gray-100 last:border-b-0 uppercase hover:text-blue-600 transition-colors"
                >
                  {option.replace('_', ' ')}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Details Group */}
      <div className="border rounded-md border-gray-200 bg-white mb-6 shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm text-gray-700">
          Details
        </div>
        
        <div className="p-4 space-y-5">
          
          {assignee && (
            <SidebarField label="Assignee">
               <div className="flex items-center gap-2 hover:bg-gray-50 p-1 -ml-1 rounded cursor-pointer group">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold overflow-hidden">
                      {usersMap[assignee] ? (
                         <Image 
                           src={resolveProfilePic(usersMap[assignee])} 
                           alt={assignee} 
                           width={24} 
                           height={24} 
                           className="w-full h-full object-cover" 
                           unoptimized 
                         />
                      ) : (
                         assignee.charAt(0).toUpperCase()
                      )}
                  </div>
                  <span className="text-sm text-blue-600 group-hover:underline">{assignee}</span>
               </div>
            </SidebarField>
          )}

          {reporter && (
            <SidebarField label="Reporter">
               <div className="flex items-center gap-2 hover:bg-gray-50 p-1 -ml-1 rounded cursor-pointer group">
                  <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold overflow-hidden">
                      {usersMap[reporter] ? (
                         <Image 
                           src={resolveProfilePic(usersMap[reporter])} 
                           alt={reporter} 
                           width={24} 
                           height={24} 
                           className="w-full h-full object-cover" 
                           unoptimized 
                         />
                      ) : (
                         reporter.charAt(0).toUpperCase()
                      )}
                  </div>
                  <span className="text-sm text-blue-600 group-hover:underline">{reporter}</span>
               </div>
            </SidebarField>
          )}

          {labels && labels.length > 0 && (
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
          )}

          {sprint && (
            <SidebarField label="Sprint">
              <span className="text-sm text-blue-600 hover:underline cursor-pointer">{sprint}</span>
            </SidebarField>
          )}

          {storyPoint > 0 && (
            <SidebarField label="Story Points">
              {isEditingStoryPoint ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editedStoryPoint}
                    onChange={(e) => setEditedStoryPoint(parseInt(e.target.value) || 0)}
                    onBlur={handleStoryPointSave}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleStoryPointSave();
                      if (e.key === 'Escape') {
                        setEditedStoryPoint(storyPoint);
                        setIsEditingStoryPoint(false);
                      }
                    }}
                    autoFocus
                    className="w-20 bg-gray-100 text-gray-700 text-xs font-bold px-2 py-1 rounded-full border-2 border-blue-500 focus:outline-none"
                  />
                </div>
              ) : (
                <span 
                  onClick={() => setIsEditingStoryPoint(true)}
                  className="bg-gray-100 text-gray-700 text-xs font-bold px-2 py-1 rounded-full inline-block cursor-pointer hover:bg-gray-200 transition-colors"
                >
                  {storyPoint}
                </span>
              )}
            </SidebarField>
          )}

          {priority && (
            <SidebarField label="Priority">
              <div className="relative">
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPriorityOpen(!isPriorityOpen);
                  }}
                  className="flex items-center gap-2 text-red-600 text-sm font-medium bg-red-50 px-2 py-1 rounded w-fit cursor-pointer hover:bg-red-100 transition-colors"
                >
                  <ArrowRight size={14} className="-rotate-45" />
                  {priority}
                </div>
                {isPriorityOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-10 min-w-[120px]">
                    {priorityOptions.map((option) => (
                      <button
                        key={option}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePriorityChange(option);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm text-gray-700 border-b border-gray-100 last:border-b-0 hover:text-blue-600 transition-colors"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </SidebarField>
          )}

        </div>
      </div>

      {/* Dates Group */}
      <div className="border rounded-md border-gray-200 bg-white shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm text-gray-700">
          Dates
        </div>
        <div className="p-4 space-y-4">
           {dates.dueDate && (
             <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 font-medium">Due date</span>
                <span className="text-sm text-gray-800 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                  {new Date(dates.dueDate).toLocaleDateString()}
                </span>
             </div>
           )}
           {dates.created && (
             <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-500 font-medium">Created</span>
                <span className="text-xs text-gray-600">{new Date(dates.created).toLocaleString()}</span>
             </div>
           )}
           {dates.updated && (
             <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-500 font-medium">Updated</span>
                <span className="text-xs text-gray-600">{new Date(dates.updated).toLocaleString()}</span>
             </div>
           )}
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