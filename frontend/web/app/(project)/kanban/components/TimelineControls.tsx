'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Calendar, User, ZoomIn, ZoomOut, Layers, EyeOff, Eye, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';

const ZOOM_LEVELS = ['Day', 'Week', 'Month'] as const;
type ZoomLevel = typeof ZOOM_LEVELS[number];
type GroupByType = 'none' | 'status' | 'assignee';

interface TimelineControlsProps {
  zoom: ZoomLevel;
  setZoom: (z: ZoomLevel) => void;
  groupBy: GroupByType;
  setGroupBy: React.Dispatch<React.SetStateAction<GroupByType>>;
  hideWeekends: boolean;
  setHideWeekends: React.Dispatch<React.SetStateAction<boolean>>;
  filterAssignee: string;
  setFilterAssignee: (v: string) => void;
  assigneeNames: string[];
  todayOffset: number;
  dayColumnWidth: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  timelineStart: Date | null;
  timelineEnd: Date | null;
}

export default function TimelineControls({
  zoom, setZoom, groupBy, setGroupBy,
  hideWeekends, setHideWeekends,
  filterAssignee, setFilterAssignee,
  assigneeNames, todayOffset, dayColumnWidth, scrollContainerRef,
  timelineStart, timelineEnd,
}: TimelineControlsProps) {
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const assigneeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(e.target as Node)) setAssigneeDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="px-4 sm:px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/60">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-slate-800">Project Timeline</h2>
          {timelineStart && timelineEnd && (
            <p className="text-xs text-slate-500 mt-0.5">
              {format(timelineStart, 'MMM d, yyyy')} – {format(timelineEnd, 'MMM d, yyyy')}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              if (todayOffset >= 0 && scrollContainerRef.current) {
                const scrollLeft = todayOffset * dayColumnWidth - scrollContainerRef.current.clientWidth / 2 + 300;
                scrollContainerRef.current.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
              }
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-600 hover:border-red-400 hover:text-red-600 transition-colors"
            title="Scroll to today"
          >
            <Calendar className="w-3.5 h-3.5" />
            Today
          </button>

          <button
            onClick={() => setHideWeekends(h => !h)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs border rounded-lg transition-colors ${
              hideWeekends ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
            }`}
            title={hideWeekends ? 'Show weekends' : 'Hide weekends'}
          >
            {hideWeekends ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            Weekends
          </button>

          {assigneeNames.length > 0 && (
            <div ref={assigneeDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setAssigneeDropdownOpen(o => !o)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-600 hover:border-slate-400 transition-colors"
              >
                <User className="w-3.5 h-3.5" />
                <span>{filterAssignee || 'All Assignees'}</span>
                <ChevronDown size={12} className="text-slate-400" />
              </button>
              {assigneeDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 min-w-[160px] max-h-48 overflow-y-auto py-1">
                  <button
                    type="button"
                    onClick={() => { setFilterAssignee(''); setAssigneeDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 transition-colors ${!filterAssignee ? 'font-semibold text-blue-600' : 'text-slate-700'}`}
                  >
                    All Assignees
                  </button>
                  {assigneeNames.map(name => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => { setFilterAssignee(name); setAssigneeDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 transition-colors ${filterAssignee === name ? 'font-semibold text-blue-600' : 'text-slate-700'}`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setGroupBy(g => g === 'none' ? 'status' : g === 'status' ? 'assignee' : 'none')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-600 hover:border-slate-400 transition-colors"
            title="Toggle group by"
          >
            <Layers className="w-3.5 h-3.5" />
            {groupBy === 'none' ? 'Group by' : `By ${groupBy}`}
          </button>

          <div className="inline-flex items-center border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => { const i = ZOOM_LEVELS.indexOf(zoom); if (i > 0) setZoom(ZOOM_LEVELS[i - 1]); }}
              disabled={zoom === ZOOM_LEVELS[0]}
              className="px-2 py-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 py-1.5 text-xs font-medium text-slate-700 border-x border-slate-200 bg-slate-50">{zoom}</span>
            <button
              onClick={() => { const i = ZOOM_LEVELS.indexOf(zoom); if (i < ZOOM_LEVELS.length - 1) setZoom(ZOOM_LEVELS[i + 1]); }}
              disabled={zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
              className="px-2 py-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
