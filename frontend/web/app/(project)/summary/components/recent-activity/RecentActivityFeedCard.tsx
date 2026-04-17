import React from 'react';
import { Task } from '@/types';
import MotionWrapper from '../MotionWrapper';
import { formatTimeAgo } from './utils';

export function RecentActivityFeedCard({ tasks = [] }: { tasks?: Task[] }) {
  const recentUpdates = React.useMemo(
    () =>
      [...tasks]
        .filter(t => t.updatedAt)
        .sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime())
        .slice(0, 5),
    [tasks]
  );

  return (
    <MotionWrapper className="bg-white rounded-xl border border-[#E3E8EF] p-5 shadow-sm hover:shadow-md transition-all duration-200">
      <h2 className="font-arimo text-[16px] font-semibold text-[#101828] mb-5 border-b border-gray-100 pb-3">Recent Activity Feed</h2>

      {recentUpdates.length === 0 ? (
        <p className="font-arimo text-[14px] text-[#98A2B3] italic bg-gray-50 p-4 rounded-lg text-center border border-dashed border-gray-200">No recent updates</p>
      ) : (
        <div className="relative border-l-2 border-gray-100 ml-3 pl-5 space-y-6">
          {recentUpdates.map((task) => {
            const isDone = task.status === 'DONE';

            return (
              <div key={task.id} className="relative">
                <div className={`absolute -left-[27px] w-6 h-6 rounded-full flex items-center justify-center border-2 border-white ${isDone ? 'bg-[#00875A]' : 'bg-[#0052CC]'}`}>
                  {task.assignee?.avatar || task.assigneeName ? (
                    <span className="text-[10px] text-white font-bold">{task.assigneeName?.substring(0, 2).toUpperCase()}</span>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      {isDone ? <polyline points="20 6 9 17 4 12"></polyline> : <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>}
                    </svg>
                  )}
                </div>

                <p className="font-arimo text-[13px] text-gray-800 leading-tight">
                  <span className="font-semibold">{task.assigneeName || 'Someone'}</span> {isDone ? 'completed' : 'updated'} <span className="font-medium text-[#0052CC]">TSK-{task.id}</span>
                </p>
                <p className="font-arimo text-[12px] text-gray-500 mt-1 truncate">{task.title}</p>
                <span className="font-arimo text-[11px] text-gray-400 absolute top-0 right-0">{formatTimeAgo(task.updatedAt)}</span>
              </div>
            );
          })}
        </div>
      )}
    </MotionWrapper>
  );
}
