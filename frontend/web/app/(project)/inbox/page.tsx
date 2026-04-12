'use client';

import { RefreshCw } from 'lucide-react';
import { PROJECT_BATCH_SIZE } from './constants';
import { ProjectSection } from './components/ProjectSection';
import { useInboxData } from './hooks/useInboxData';

export default function InboxPage() {
  const {
    loading,
    error,
    filter,
    setFilter,
    isMarkingAllRead,
    unreadCount,
    groupedProjects,
    visibleProjects,
    hasMoreProjects,
    setVisibleProjectCount,
    openActivity,
    markAllAsRead,
    refreshInbox,
  } = useInboxData();

  return (
    <div className="mobile-page-padding max-w-[900px] mx-auto pb-28 sm:pb-8 flex flex-col gap-4 sm:gap-5">
      <div className="flex items-start gap-3">
        <div>
          <h1 className="text-[18px] sm:text-[22px] md:text-[26px] font-bold text-slate-900 tracking-tight">Chat Inbox</h1>
          <p className="text-[12px] sm:text-[13px] text-slate-600 mt-1">
            All chat activity grouped by project. Open any conversation directly from here.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-2 min-h-[44px] rounded-lg text-[13px] sm:text-[12px] font-semibold transition-colors ${
            filter === 'all' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
          }`}
        >
          All Activity
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-3 py-2 min-h-[44px] rounded-lg text-[13px] sm:text-[12px] font-semibold transition-colors ${
            filter === 'unread' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Unread Only
        </button>

        <button
          onClick={() => void markAllAsRead()}
          disabled={unreadCount === 0 || loading || isMarkingAllRead}
          className="px-3 py-2 min-h-[44px] rounded-lg text-[13px] sm:text-[12px] font-semibold transition-colors border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isMarkingAllRead ? 'Marking…' : 'Mark All Read'}
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((row) => (
            <div key={row} className="bg-white border border-slate-200 rounded-2xl p-4 animate-pulse">
              <div className="h-4 w-48 bg-slate-200 rounded" />
              <div className="h-3 w-32 bg-slate-100 rounded mt-2" />
              <div className="h-12 w-full bg-slate-100 rounded-xl mt-4" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-white border border-red-200 rounded-2xl p-6 text-center">
          <p className="text-[14px] font-semibold text-red-600">{error}</p>
          <button
            onClick={() => void refreshInbox()}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-[12px] font-semibold hover:bg-red-100"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      ) : groupedProjects.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <h2 className="text-[16px] font-bold text-slate-800">No chat activity yet</h2>
          <p className="text-[13px] text-slate-500 mt-1">Start a team, room, or direct conversation to populate your inbox.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {visibleProjects.map((group) => (
            <ProjectSection
              key={group.projectId}
              group={group}
              onActivityClick={openActivity}
            />
          ))}

          {hasMoreProjects && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => setVisibleProjectCount((prev) => prev + PROJECT_BATCH_SIZE)}
                className="px-4 py-2 rounded-lg text-[12px] font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                Load more projects ({groupedProjects.length - visibleProjects.length} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
