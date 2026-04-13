'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SearchIcon } from './SidebarIcons';

/* ── Types ── */
interface Project {
  id: number;
  name: string;
  projectKey?: string;
  isFavorite?: boolean;
}

/* stable colour per project id */
const PROJECT_COLOURS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500',
  'bg-amber-500', 'bg-rose-500', 'bg-indigo-500', 'bg-teal-500',
];
function projectColour(id: number) {
  return PROJECT_COLOURS[Math.abs(id) % PROJECT_COLOURS.length];
}

/* ── Dropdown Item ── */
function DropdownItem({
  project, onProjectClick, onToggleFav, isToggling,
}: {
  project: Project;
  onProjectClick: () => void;
  onToggleFav?: (e: React.MouseEvent, p: Project) => void;
  isToggling: boolean;
}) {
  const colour = projectColour(project.id);
  return (
    <div
      className="group flex items-center gap-2.5 px-3 py-2 hover:bg-cu-hover transition-colors cursor-pointer"
      onClick={onProjectClick}
    >
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colour}`} />
      <div className="flex flex-col flex-1 min-w-0">
        <span className="text-[12.5px] font-medium text-cu-text-primary truncate leading-tight">{project.name}</span>
        {project.projectKey && (
          <span className="text-[10.5px] text-cu-text-muted truncate">{project.projectKey}</span>
        )}
      </div>
      {onToggleFav && (
        <button
          onClick={e => onToggleFav(e, project)}
          disabled={isToggling}
          title="Remove from favourites"
          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-0.5 rounded text-amber-400 hover:text-gray-400 disabled:cursor-not-allowed"
        >
          <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor">
            <path d="m10 2.8 2.2 4.6 5 .7-3.6 3.5.9 5L10 14.7 5.5 16.6l.9-5L2.8 8.1l5-.7L10 2.8z" />
          </svg>
        </button>
      )}
    </div>
  );
}

/* ── Project Dropdown ── */
export function ProjectDropdown({
  fixedTop, fixedLeft,
  items, loading, search, onSearch, emptyMsg, placeholder,
  viewAllHref, viewAllLabel, onProjectClick, onToggleFav, togglingId,
}: {
  fixedTop: number;
  fixedLeft: number;
  items: Project[];
  loading: boolean;
  search: string;
  onSearch: (v: string) => void;
  emptyMsg: string;
  placeholder: string;
  viewAllHref: string;
  viewAllLabel: string;
  onProjectClick: (p: Project) => void;
  onToggleFav?: (e: React.MouseEvent, p: Project) => void;
  togglingId?: number | null;
}) {
  const router = useRouter();
  const visible = items.slice(0, 4);

  return (
    <div
      data-sidebar-dropdown
      className="bg-white rounded-xl border border-cu-border shadow-2xl shadow-black/10 overflow-hidden"
      style={{
        position: 'fixed',
        top: fixedTop,
        left: fixedLeft,
        width: '248px',
        zIndex: 9999,
        animation: 'dropdownIn 180ms cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* Search bar */}
      <div className="px-3 pt-3 pb-2 border-b border-cu-border-light">
        <div className="relative">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <SearchIcon />
          </div>
          <input
            type="text"
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder={placeholder}
            autoFocus
            className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-cu-bg-tertiary border border-cu-border rounded-lg placeholder-cu-text-muted text-cu-text-primary focus:outline-none focus:ring-1 focus:ring-cu-primary/30 focus:border-cu-primary/40 transition-all"
          />
        </div>
      </div>

      {/* Items list */}
      <div className="py-1">
        {loading ? (
          <div className="px-3 py-3 flex flex-col gap-2 animate-pulse">
            <div className="h-2 w-32 bg-gray-100 rounded" />
            <div className="h-2 w-24 bg-gray-100 rounded" />
          </div>
        ) : visible.length > 0 ? (
          visible.map(project => (
            <DropdownItem
              key={project.id}
              project={project}
              onProjectClick={() => { onProjectClick(project); router.push(`/summary/${project.id}`); }}
              onToggleFav={onToggleFav}
              isToggling={(togglingId ?? -1) === project.id}
            />
          ))
        ) : (
          <div className="px-3 py-3 text-[12px] text-cu-text-muted italic">{emptyMsg}</div>
        )}
      </div>

      {/* View all footer */}
      <div className="border-t border-cu-border-light px-3 py-2">
        <Link
          href={viewAllHref}
          className="flex items-center gap-1.5 text-[12px] font-medium text-cu-primary hover:text-cu-primary-dark transition-colors"
        >
          <span>{viewAllLabel}</span>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3 6h6M7 4l2 2-2 2" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
