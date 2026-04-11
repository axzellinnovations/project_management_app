import { CheckCheck, Trash2 } from 'lucide-react';

interface NotificationHeaderProps {
  unreadCount: number;
  totalCount: number;
  isDeletingAll: boolean;
  onMarkAllAsRead: () => void;
  onDeleteAll: () => void;
}

export function NotificationHeader({
  unreadCount,
  totalCount,
  isDeletingAll,
  onMarkAllAsRead,
  onDeleteAll,
}: NotificationHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="font-outfit text-2xl sm:text-[32px] font-bold text-[#101828]">Notifications</h1>
        <p className="text-xs sm:text-sm text-[#4A5565] mt-1 font-outfit leading-relaxed">
          Stay updated with task changes, chat activity, and project events.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <button
          type="button"
          onClick={onMarkAllAsRead}
          disabled={unreadCount === 0}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D0D5DD] bg-white px-3 py-2 text-xs font-bold text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-50 transition-all active:scale-95 font-outfit"
        >
          <CheckCheck size={14} />
          Mark all as read
        </button>
        <button
          type="button"
          onClick={onDeleteAll}
          disabled={totalCount === 0 || isDeletingAll}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-100 bg-white px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 transition-all active:scale-95 font-outfit"
        >
          <Trash2 size={14} />
          {isDeletingAll ? 'Deleting...' : 'Delete all'}
        </button>
      </div>
    </div>
  );
}
