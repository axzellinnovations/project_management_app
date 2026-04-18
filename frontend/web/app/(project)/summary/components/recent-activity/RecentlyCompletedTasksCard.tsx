import React from 'react';
import { Task } from '@/types';
import { formatTimeAgo } from './utils';
import { CheckCircle2, Trophy } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

export function RecentlyCompletedTasksCard({ tasks = [] }: { tasks?: Task[] }) {
  const completedTasks = React.useMemo(
    () =>
      [...tasks]
        .filter(t => t.status === 'DONE' || t.status === 'COMPLETED')
        .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
        .slice(0, 5),
    [tasks]
  );

  return (
    <div className="h-full relative overflow-hidden">
      {/* Decorative Blob */}
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-[#00875A]/10 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute right-[-10px] top-[-10px] text-[#00875A]/5 rotate-12 z-0 pointer-events-none">
        <Trophy size={120} strokeWidth={1} />
      </div>

      {completedTasks.length === 0 ? (
        <div className="py-6 px-4 flex flex-col items-center justify-center bg-white/50 rounded-xl border border-dashed border-gray-200">
          <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mb-2">
            <CheckCircle2 size={16} className="text-gray-300" />
          </div>
          <p className="font-arimo text-[13px] text-[#98A2B3] font-medium">No completed tasks yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 relative z-10">
          {completedTasks.map((task, i) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let photoUrl = (task as any).assigneePhotoUrl || (task as any).assignee?.profilePicUrl;
            if (photoUrl && !photoUrl.startsWith('http')) {
              photoUrl = `${API_BASE_URL}${photoUrl.startsWith('/') ? '' : '/'}${photoUrl}`;
            }

            return (
              <div 
                key={task.id} 
                className="group flex items-center gap-3 p-2.5 bg-white rounded-xl border border-gray-100/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_12px_rgba(0,135,90,0.06)] hover:border-[#00875A]/20 transition-all duration-300 transform hover:-translate-y-[1px]"
              >
                {/* Ranking Number */}
                <div className="w-5 font-arimo text-[10px] font-black text-gray-300 flex justify-center shrink-0">
                  #{i + 1}
                </div>

                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-gray-100 to-gray-200 flex items-center justify-center border-2 border-white shadow-sm shrink-0 overflow-hidden ring-1 ring-black/5">
                  {photoUrl ? (
                    <img src={photoUrl} alt="Avatar" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                    <span className="text-[11px] font-extrabold text-gray-500 bg-clip-text">
                      {(task.assigneeName || 'U').substring(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                
                {/* Task Details */}
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-arimo text-[13px] font-bold text-[#101828] truncate mb-0.5 group-hover:text-[#00875A] transition-colors">
                    {task.title}
                  </span>
                  <div className="flex items-center gap-1.5 font-arimo text-[11px] text-[#667085] truncate">
                    <span>by</span>
                    <span className="font-bold text-gray-700 bg-gray-100/80 px-1.5 py-0.5 rounded-md">
                      {task.assigneeName || 'Someone'}
                    </span>
                  </div>
                </div>

                {/* End Section */}
                <div className="flex flex-col items-end shrink-0 pl-2">
                  <span className="text-[10px] font-bold text-[#00875A] bg-[#00875A]/10 px-2 py-0.5 rounded-md mb-1 border border-[#00875A]/20 uppercase tracking-wide">
                    TSK-{task.id}
                  </span>
                  <span className="text-[10px] font-medium text-gray-400">
                    {task.updatedAt ? formatTimeAgo(task.updatedAt) : 'Recently'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
