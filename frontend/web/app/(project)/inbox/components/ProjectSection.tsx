// UI component rendering a group of chat activities belonging to a single project.
import { memo, useState } from 'react';
import type { ChatInboxActivity, ChatInboxProjectGroup } from '@/services/chat-service';
import { ACTIVITY_PREVIEW_COUNT } from '../constants';
import { ActivityRow } from './ActivityRow';

import { ActivityRow } from './ActivityRow';

// =====================================================
// PROJECT SECTION COMPONENT
// =====================================================
export const ProjectSection = memo(function ProjectSection({
  group,
  onActivityClick,
}: {
  group: ChatInboxProjectGroup;
  onActivityClick: (activity: ChatInboxActivity) => void;
}) {
  // Controls whether to show all activities or just a preview subset to keep the initial list compact.
  const [showAllActivities, setShowAllActivities] = useState(false);
  const visibleActivities = showAllActivities
    ? group.activities
    : group.activities.slice(0, ACTIVITY_PREVIEW_COUNT);
  const hasHiddenActivities = group.activities.length > ACTIVITY_PREVIEW_COUNT;

  return (
    <section
      className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 md:p-5"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '420px' }}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-[16px] font-bold text-slate-900">{group.projectName}</h2>
          <p className="text-[12px] text-slate-500 mt-0.5">{group.totalItems} chats · {group.unreadCount} unread</p>
        </div>
        <span className="text-[10px] uppercase tracking-wide font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
          Project {group.projectId}
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {visibleActivities.map((activity) => (
          <ActivityRow
            key={`${activity.chatType}-${activity.projectId}-${activity.roomId || activity.username || 'team'}`}
            activity={activity}
            onActivityClick={onActivityClick}
          />
        ))}
      </div>

      {hasHiddenActivities && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setShowAllActivities((prev) => !prev)}
            className="px-3 py-2 min-h-[44px] rounded-lg text-[13px] sm:text-[12px] font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          >
            {showAllActivities
              ? 'Show less'
              : `Show ${group.activities.length - ACTIVITY_PREVIEW_COUNT} more`}
          </button>
        </div>
      )}
    </section>
  );
});
