'use client';

import { useState } from 'react';
import CalendarEventCard from './CalendarEventCard';
import CalendarEventPopup from './CalendarEventPopup';
import type { CalendarEventItem } from '../types';
import {
  DAY_NAMES,
  addDays,
  isSameDay,
  startOfDay,
  endOfDay,
  startOfMonthGrid,
  endOfMonthGrid,
  toDate,
} from '../utils/date';

interface MonthCalendarViewProps {
  currentDate: Date;
  events: CalendarEventItem[];
  onDayClick?: (date: Date) => void;
  onEventDrop?: (eventId: string, newDate: Date) => void;
}

interface LaneSlot {
  event: CalendarEventItem;
  lane: number;
  startCol: number; // 0-6 within this week
  endCol: number;   // 0-6 within this week
  isStart: boolean; // event actually starts this week (left rounded corner)
  isEnd: boolean;   // event actually ends this week (right rounded corner)
}

const LANE_H = 24;      // px height of each event bar
const LANE_GAP = 3;     // px gap between lanes
const MAX_LANES = 4;    // max visible lanes before "+N more"

// ── Lane assignment for one week row ─────────────────────────────────────────
function computeWeekLanes(weekDays: Date[], events: CalendarEventItem[]): LaneSlot[] {
  const weekStart = startOfDay(weekDays[0]);
  const weekEnd   = endOfDay(weekDays[6]);

  // Collect events that overlap this week
  const relevant = events.filter(event => {
    const s = toDate(event.startDate || event.dueDate || event.endDate);
    const e = toDate(event.endDate   || event.startDate || event.dueDate);
    if (!s) return false;
    const es = startOfDay(s);
    const ee = endOfDay(e ?? s);
    return es <= weekEnd && ee >= weekStart;
  });

  // Sort: sprints first, then by span length (longer = higher priority lane)
  relevant.sort((a, b) => {
    if (a.kind === 'sprint' && b.kind !== 'sprint') return -1;
    if (a.kind !== 'sprint' && b.kind === 'sprint') return  1;
    const aS = toDate(a.startDate || a.dueDate || a.endDate);
    const aE = toDate(a.endDate   || a.startDate || a.dueDate);
    const bS = toDate(b.startDate || b.dueDate || b.endDate);
    const bE = toDate(b.endDate   || b.startDate || b.dueDate);
    const aDur = aS && aE ? aE.getTime() - aS.getTime() : 0;
    const bDur = bS && bE ? bE.getTime() - bS.getTime() : 0;
    return bDur - aDur;
  });

  const slots: LaneSlot[] = [];
  // laneUsed[lane][col] = true if that column is taken in that lane
  const laneUsed: boolean[][] = [];

  for (const event of relevant) {
    const eventStart = toDate(event.startDate || event.dueDate || event.endDate);
    const eventEnd   = toDate(event.endDate   || event.startDate || event.dueDate);
    if (!eventStart) continue;
    const es = startOfDay(eventStart);
    const ee = endOfDay(eventEnd ?? eventStart);

    // Determine which columns (0-6) this event occupies in this week
    let startCol = 0;
    let endCol   = 6;
    for (let c = 0; c < 7; c++) {
      if (startOfDay(weekDays[c]) >= es) { startCol = c; break; }
    }
    for (let c = 6; c >= 0; c--) {
      if (startOfDay(weekDays[c]) <= ee) { endCol = c; break; }
    }

    // Find the first lane where startCol..endCol are all free
    let lane = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (!laneUsed[lane]) laneUsed[lane] = Array(7).fill(false);
      let fits = true;
      for (let c = startCol; c <= endCol; c++) {
        if (laneUsed[lane][c]) { fits = false; break; }
      }
      if (fits) break;
      lane++;
    }

    // Mark occupied
    if (!laneUsed[lane]) laneUsed[lane] = Array(7).fill(false);
    for (let c = startCol; c <= endCol; c++) laneUsed[lane][c] = true;

    slots.push({
      event,
      lane,
      startCol,
      endCol,
      isStart: isSameDay(es, weekStart) || es > weekStart,
      isEnd:   isSameDay(ee, weekEnd)   || ee < weekEnd,
    });
  }

  return slots;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MonthCalendarView({
  currentDate, events, onDayClick, onEventDrop,
}: MonthCalendarViewProps) {
  const [popup, setPopup] = useState<{ event: CalendarEventItem; x: number; y: number } | null>(null);
  const [draggedId, setDraggedId]     = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);

  const handleEventClick = (event: CalendarEventItem, x: number, y: number) =>
    setPopup({ event, x, y });

  // Build full grid then split into week rows
  const gridStart = startOfMonthGrid(currentDate);
  const gridEnd   = endOfMonthGrid(currentDate);
  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(new Date(d));

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-white overflow-hidden">
      {/* Day-name header */}
      <div className="grid grid-cols-7 border-b border-[#EAECF0]">
        {DAY_NAMES.map(name => (
          <div key={name} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#667085]">
            {name}
          </div>
        ))}
      </div>

      {/* Week rows */}
      {weeks.map((weekDays, weekIdx) => {
        const slots = computeWeekLanes(weekDays, events);

        // Split into visible lanes and overflow
        const visible  = slots.filter(s => s.lane < MAX_LANES);
        const overflow = slots.filter(s => s.lane >= MAX_LANES);

        // Per-column overflow count for "+N more" labels
        const colOverflow = Array(7).fill(0);
        for (const s of overflow) {
          for (let c = s.startCol; c <= s.endCol; c++) colOverflow[c]++;
        }

        const visibleLaneCount = visible.length > 0
          ? Math.max(...visible.map(s => s.lane)) + 1
          : 0;
        const eventsAreaH = visibleLaneCount * (LANE_H + LANE_GAP) + (overflow.length ? 18 : 4);

        return (
          <div key={weekIdx} className="border-b border-[#F2F4F7] last:border-b-0">

            {/* Day-number strip — also the drop targets */}
            <div className="grid grid-cols-7">
              {weekDays.map((day, dayIdx) => {
                const inMonth  = day.getMonth() === currentDate.getMonth();
                const dropKey  = `${day.toISOString().slice(0, 10)}-${weekIdx}-${dayIdx}`;
                const isTarget = dropTargetKey === dropKey;
                const overflow = colOverflow[dayIdx];

                return (
                  <div
                    key={dropKey}
                    className={[
                      'border-r border-[#F2F4F7] last:border-r-0 px-2 pt-2 pb-1',
                      onDayClick ? 'cursor-pointer hover:bg-[#F9FAFB]' : '',
                      isTarget ? 'bg-[#EFF8FF]' : '',
                      'transition-colors',
                    ].join(' ')}
                    onClick={() => onDayClick?.(day)}
                    onDragOver={e => { if (draggedId) { e.preventDefault(); setDropTargetKey(dropKey); } }}
                    onDragLeave={() => setDropTargetKey(null)}
                    onDrop={e => {
                      e.preventDefault();
                      if (draggedId && onEventDrop) onEventDrop(draggedId, day);
                      setDraggedId(null);
                      setDropTargetKey(null);
                    }}
                  >
                    <div className={`text-xs font-semibold leading-none ${inMonth ? 'text-[#101828]' : 'text-[#98A2B3]'}`}>
                      {day.getDate()}
                    </div>
                    {overflow > 0 && (
                      <div className="mt-0.5 text-[10px] font-medium text-[#667085]">
                        +{overflow} more
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Absolutely-positioned event bars */}
            <div className="relative" style={{ height: eventsAreaH }}>
              {visible.map(({ event, lane, startCol, endCol, isStart, isEnd }) => {
                const colPct  = 100 / 7;
                const leftPct = startCol * colPct;
                const widPct  = (endCol - startCol + 1) * colPct;
                const top     = lane * (LANE_H + LANE_GAP) + 2;

                return (
                  <div
                    key={`${event.id}-w${weekIdx}`}
                    className="absolute"
                    style={{
                      left:   `calc(${leftPct}% + 2px)`,
                      width:  `calc(${widPct}%  - 4px)`,
                      top,
                      height: LANE_H,
                    }}
                  >
                    <CalendarEventCard
                      event={event}
                      compact
                      positioned
                      isRangeSegmentStart={isStart}
                      isRangeSegmentEnd={isEnd}
                      onClick={handleEventClick}
                      onDragStart={id => setDraggedId(id)}
                      isDragging={draggedId === event.id}
                    />
                  </div>
                );
              })}
            </div>

          </div>
        );
      })}

      {popup && (
        <CalendarEventPopup
          event={popup.event}
          position={{ x: popup.x, y: popup.y }}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  );
}
