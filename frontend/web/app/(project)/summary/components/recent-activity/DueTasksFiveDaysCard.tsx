import React from 'react';
import { Task } from '@/types';
import { Clock } from 'lucide-react';

export function DueTasksFiveDaysCard({ tasks = [] }: { tasks?: Task[] }) {
  const todayStart = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }, []);

  const fiveDaysEnd = React.useMemo(() => {
    const limit = new Date(todayStart);
    limit.setDate(limit.getDate() + 5);
    limit.setHours(23, 59, 59, 999);
    return limit;
  }, [todayStart]);

  const upcomingFiveDayTasks = React.useMemo(
    () =>
      [...tasks]
        .filter((t) => {
          if (!t.dueDate || t.status === 'DONE') return false;
          const due = new Date(t.dueDate);
          return due >= todayStart && due <= fiveDaysEnd;
        })
        .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
        .slice(0, 8),
    [tasks, todayStart, fiveDaysEnd]
  );

  return (
    <div className="h-full">

      {upcomingFiveDayTasks.length === 0 ? (
        <p className="font-arimo text-[13px] text-[#98A2B3] bg-gray-50 p-4 rounded-lg text-center border border-dashed border-gray-200">
          No tasks due in the next 5 days.
        </p>
      ) : (
        <div className="space-y-4 bento-no-drag">
          {upcomingFiveDayTasks.map((task) => {
            const dueDate = new Date(task.dueDate!);
            const daysDiff = Math.ceil((dueDate.getTime() - todayStart.getTime()) / (1000 * 3600 * 24));
            const dueLabel = daysDiff === 0 ? 'Due Today' : `In ${daysDiff} day${daysDiff > 1 ? 's' : ''}`;
            const dueColorClass = daysDiff === 0
              ? 'bg-red-50 text-red-700 border border-red-100'
              : daysDiff <= 2
                ? 'bg-amber-50 text-amber-700 border border-amber-100'
                : 'bg-blue-50 text-blue-700 border border-blue-100';

            return (
              <div 
                key={task.id} 
                className="p-3 rounded-xl border border-gray-200 bg-white hover:border-blue-200 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock size={13} className="text-blue-500 flex-shrink-0" />
                    <p className="font-arimo text-[13px] font-semibold text-gray-800 truncate">
                      {task.title}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${dueColorClass}`}>
                    {dueLabel}
                  </span>
                </div>
                
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[11px] font-arimo text-gray-500 truncate">
                    <span className="font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">TSK-{task.id}</span>
                    <span className="truncate">{task.assigneeName || 'Unassigned'}</span>
                  </div>
                  <span className="text-[11px] font-arimo text-gray-500 whitespace-nowrap">
                    {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
