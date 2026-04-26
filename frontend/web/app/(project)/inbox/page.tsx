// Main UI component for the Chat Inbox page.
// Displays and filters chat conversations grouped by project, consuming state and logic from useInboxData.
'use client';

import { RefreshCw } from 'lucide-react';
import { PROJECT_BATCH_SIZE } from './constants';
import { ProjectSection } from './components/ProjectSection';
import { useInboxData } from './hooks/useInboxData';
import Link from 'next/link';

// =====================================================
// INBOX PAGE RENDER
// =====================================================
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
    <div className="mobile-page-padding w-full max-w-[1200px] mx-auto pb-6 flex flex-col gap-4 sm:gap-5">
      {/* ===================================================== */}
      {/* MOBILE HEADER */}
      {/* ===================================================== */}
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

      {/* ===================================================== */}
      {/* DESKTOP HEADER & FILTERS */}
      {/* ===================================================== */}
      <div className="flex flex-col gap-1 sm:mb-2">
          <div className="flex items-center gap-2 text-[13px] text-[#4A5565]">
              <Link href="/dashboard" className="hover:text-[#0052CC]">Dashboard</Link>
              <span>/</span>
              <span className="font-medium text-[#101828]">Inbox</span>
          </div>
          <h1 className="font-outfit text-2xl sm:text-[32px] font-bold text-[#101828]">Chat Inbox</h1>
          <p className="text-[13px] text-slate-500 sm:mt-1">
            All chat activity grouped by project. Open any conversation directly from here.
          </p>
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

      {/* ===================================================== */}
      {/* INBOX CONTENT (LOADING / ERROR / EMPTY / LIST) */}
      {/* ===================================================== */}
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
        <div className="w-full bg-white border border-red-200 rounded-2xl p-6 text-center">
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
        <div className="w-full bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
          <h2 className="text-[16px] font-bold text-slate-800">
            {filter === 'unread' ? 'All caught up!' : 'No chat activity yet'}
          </h2>
          <p className="text-[13px] text-slate-500 mt-1">
            {filter === 'unread'
              ? 'You have no unread messages. Switch to All Activity to browse all conversations.'
              : 'Start a team, room, or direct conversation to populate your inbox.'}
          </p>
        </div>
      ) : (
        <div className="w-full flex flex-col gap-4">
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
