'use client';

import { useState } from 'react';
import CalendarEventCard from './CalendarEventCard';
import CalendarEventPopup from './CalendarEventPopup';
import type { CalendarEventItem } from '../types';
import {
  DAY_NAMES,
  addDays,
  isDateInRange,
  isSameDay,
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

const getEventsForDate = (events: CalendarEventItem[], day: Date) =>
  events.filter((event) => {
    if (event.kind === 'sprint') {
      return isDateInRange(day, event.startDate, event.endDate);
    }

    const exact = toDate(event.startDate || event.dueDate || event.endDate);
    return exact ? isSameDay(day, exact) : false;
  });

export default function MonthCalendarView({ currentDate, events, onDayClick, onEventDrop }: MonthCalendarViewProps) {
  const [popup, setPopup] = useState<{ event: CalendarEventItem; x: number; y: number } | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);

  const handleEventClick = (event: CalendarEventItem, clientX: number, clientY: number) => {
    setPopup({ event, x: clientX, y: clientY });
  };
  const start = startOfMonthGrid(currentDate);
  const end = endOfMonthGrid(currentDate);

  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    days.push(new Date(d));
  }

  const dateKey = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-white">
      <div className="grid grid-cols-7 border-b border-[#EAECF0]">
        {DAY_NAMES.map((name) => (
          <div key={name} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#667085]">
            {name}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dayEvents = getEventsForDate(events, day);
          const inCurrentMonth = day.getMonth() === currentDate.getMonth();
          const key = `${dateKey(day)}-${idx}`;
          const isDropTarget = dropTargetKey === key;

          return (
            <div
              key={key}
              className={`min-h-[130px] border-b border-r border-[#F2F4F7] p-2 transition-colors${onDayClick ? ' cursor-pointer hover:bg-[#F9FAFB]' : ''}${isDropTarget ? ' bg-[#EFF8FF] border-[#175CD3]' : ''}`}
              onClick={() => onDayClick?.(day)}
              onDragOver={(e) => { if (draggedId) { e.preventDefault(); setDropTargetKey(key); } }}
              onDragLeave={() => setDropTargetKey(null)}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedId && onEventDrop) {
                  onEventDrop(draggedId, day);
                }
                setDraggedId(null);
                setDropTargetKey(null);
              }}
            >
              <div className={`mb-2 text-xs font-semibold ${inCurrentMonth ? 'text-[#101828]' : 'text-[#98A2B3]'}`}>
                {day.getDate()}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 4).map((event) => {
                  const eventStart = toDate(event.startDate || event.dueDate || event.endDate);
                  const eventEnd = toDate(event.endDate || event.startDate || event.dueDate);

                  return (
                    <CalendarEventCard
                      key={`${event.id}-${day.toDateString()}`}
                      event={event}
                      compact
                      isSprintSegmentStart={!eventStart || isSameDay(day, eventStart)}
                      isSprintSegmentEnd={!eventEnd || isSameDay(day, eventEnd)}
                      onClick={handleEventClick}
                      onDragStart={(id) => setDraggedId(id)}
                      isDragging={draggedId === event.id}
                    />
                  );
                })}
                {dayEvents.length > 4 && (
                  <div className="text-[10px] font-medium text-[#667085]">+{dayEvents.length - 4} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
