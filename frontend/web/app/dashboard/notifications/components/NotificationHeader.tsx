import { CheckCheck, Trash2 } from 'lucide-react';
import Link from 'next/link';

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
    <div className="flex flex-col">
      {/* Mobile Top Header */}
      <div className="flex items-center gap-3 py-4 md:hidden">
          <button
              onClick={() => window.dispatchEvent(new CustomEvent('planora:sidebar:toggle'))}
              className="p-2 -ml-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors border border-slate-100"
              aria-label="Toggle Sidebar"
          >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
          </button>
          <div className="font-outfit text-xl font-extrabold tracking-tight text-[#101828] flex items-center gap-2">
              <span className="w-2 h-5 bg-blue-600 rounded-full"></span>
              PLANORA
          </div>
      </div>

      <div className="flex flex-col sm:mb-2 mt-0">
          <div className="flex items-center gap-2 text-[13px] text-[#4A5565] mb-1">
              <Link href="/dashboard" className="hover:text-[#0052CC]">Dashboard</Link>
              <span>/</span>
              <span className="font-medium text-[#101828]">Notifications</span>
          </div>
          
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
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D0D5DD] bg-white px-3 py-2.5 min-h-[44px] sm:min-h-0 text-xs font-bold text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-50 transition-all active:scale-95 font-outfit"
        >
          <CheckCheck size={14} />
          Mark all as read
        </button>
        <button
          type="button"
          onClick={onDeleteAll}
          disabled={totalCount === 0 || isDeletingAll}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-100 bg-white px-3 py-2.5 min-h-[44px] sm:min-h-0 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 transition-all active:scale-95 font-outfit"
        >
          <Trash2 size={14} />
          {isDeletingAll ? 'Deleting...' : 'Delete all'}
        </button>
      </div>
          </div>
      </div>
    </div>
  );
}
