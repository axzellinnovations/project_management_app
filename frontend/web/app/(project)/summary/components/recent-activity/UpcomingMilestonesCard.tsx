import React from 'react';
import Link from 'next/link';
import { Flag } from 'lucide-react';
import { MilestoneResponse } from '@/types';
import { STATUS_CONFIG } from '../../../milestones/components/milestoneConfig';

interface UpcomingMilestonesCardProps {
  projectId: number;
  milestones?: MilestoneResponse[];
  milestonesLoading?: boolean;
}

export function UpcomingMilestonesCard({
  projectId,
  milestones = [],
  milestonesLoading = false,
}: UpcomingMilestonesCardProps) {
  const todayStart = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }, []);

  const upcomingMilestones = React.useMemo(
    () =>
      [...milestones]
        .filter((m) => m.status !== 'COMPLETED' && m.status !== 'ARCHIVED')
        .sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return a.name.localeCompare(b.name);
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        })
        .slice(0, 4),
    [milestones]
  );

  return (
    <div className="h-full">
      {milestonesLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-gray-100/70 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : upcomingMilestones.length === 0 ? (
        <p className="font-arimo text-[13px] text-[#98A2B3] bg-gray-50 p-4 rounded-lg text-center border border-dashed border-gray-200">No upcoming milestones.</p>
      ) : (
        <div className="space-y-4 bento-no-drag">
          {upcomingMilestones.map((milestone) => {
            const statusKey = Object.prototype.hasOwnProperty.call(STATUS_CONFIG, milestone.status)
              ? (milestone.status as keyof typeof STATUS_CONFIG)
              : 'OPEN';
            const statusConf = STATUS_CONFIG[statusKey];

            const dueDate = milestone.dueDate ? new Date(milestone.dueDate) : null;
            const daysDiff = dueDate
              ? Math.ceil((dueDate.getTime() - todayStart.getTime()) / (1000 * 3600 * 24))
              : null;
            const isOverdue = Boolean(dueDate && milestone.status === 'OPEN' && dueDate < todayStart);

            return (
              <div key={milestone.id} className="p-3 rounded-xl border border-gray-200 bg-white hover:border-blue-200 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Flag size={13} className={milestone.status === 'COMPLETED' ? 'text-green-500' : 'text-blue-500'} />
                    <p className="font-arimo text-[13px] font-semibold text-gray-800 truncate">{milestone.name}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${statusConf.badge}`}>
                    {statusConf.label}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className={`text-[11px] font-arimo ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                    {dueDate
                      ? dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : 'No due date'}
                  </span>
                  <span className={`text-[11px] font-bold whitespace-nowrap ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
                    {dueDate
                      ? (isOverdue
                        ? `${Math.abs(daysDiff ?? 0)}d overdue`
                        : daysDiff === 0
                          ? 'Due today'
                          : `In ${daysDiff} day${(daysDiff ?? 0) > 1 ? 's' : ''}`)
                      : `${milestone.taskCount} tasks`}
                  </span>
                </div>
              </div>
            );
          })}

          <Link
            href={`/milestones?projectId=${projectId}`}
            className="bento-no-drag inline-flex items-center justify-center gap-1.5 w-full mt-1 py-2.5 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors font-arimo text-[12px] font-bold"
          >
            Open Milestones
          </Link>
        </div>
      )}
    </div>
  );
}
