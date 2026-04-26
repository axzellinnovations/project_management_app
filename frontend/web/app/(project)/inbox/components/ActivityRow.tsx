// UI component rendering a single chat conversation (team, room, or DM) within the inbox list.
import { memo, useCallback } from 'react';
import { MessageSquare, UserRound, Users } from 'lucide-react';
import type { ChatInboxActivity } from '@/services/chat-service';
import { formatRelativeTime, getChatTypeLabel } from '../utils';

// Helper to render the appropriate icon based on the chat type.
function getChatTypeIcon(activity: ChatInboxActivity) {
  if (activity.chatType === 'TEAM') {
    return <Users size={16} className="text-blue-600" />;
  }

  if (activity.chatType === 'ROOM') {
    return <MessageSquare size={16} className="text-indigo-600" />;
  }

  return <UserRound size={16} className="text-emerald-600" />;
}

// =====================================================
// ACTIVITY ROW COMPONENT
// =====================================================
export const ActivityRow = memo(function ActivityRow({
  activity,
  onActivityClick,
}: {
  activity: ChatInboxActivity;
  onActivityClick: (activity: ChatInboxActivity) => void;
}) {
  const handleClick = useCallback(() => {
    onActivityClick(activity);
  }, [activity, onActivityClick]);

  return (
    <button
      onClick={handleClick}
      className="w-full text-left px-4 py-4 min-h-[44px] rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30 transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            {getChatTypeIcon(activity)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[14px] sm:text-[13px] font-semibold text-slate-900 truncate">{getChatTypeLabel(activity)}</p>
              <span className="text-[11px] sm:text-[10px] font-bold uppercase tracking-wide text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                {activity.chatType}
              </span>
            </div>
            <p className="text-[12px] sm:text-[11px] text-slate-500 mt-0.5 truncate">{activity.projectName}</p>
            <p className="text-[13px] sm:text-[12px] text-slate-600 mt-1 truncate">
              {activity.lastMessageSender && <span className="font-semibold text-slate-700">{activity.lastMessageSender}: </span>}
              {activity.lastMessage || 'No messages yet'}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-[11px] text-slate-500">{formatRelativeTime(activity.lastMessageTimestamp)}</span>
          {activity.unread ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
              {activity.unseenCount > 99 ? '99+' : activity.unseenCount}
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
              READ
            </span>
          )}
        </div>
      </div>
    </button>
  );
});
