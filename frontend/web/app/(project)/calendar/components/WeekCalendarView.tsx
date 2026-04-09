import CalendarEventCard from './CalendarEventCard';
import type { CalendarEventItem } from '../types';
import { DAY_NAMES, addDays, isDateInRange, isSameDay, startOfWeek, toDate } from '../utils/date';

interface WeekCalendarViewProps {
  currentDate: Date;
  events: CalendarEventItem[];
  onDayClick?: (date: Date) => void;
}

const eventsForDay = (events: CalendarEventItem[], day: Date) =>
  events.filter((event) => {
    if (event.kind === 'sprint') {
      return isDateInRange(day, event.startDate, event.endDate);
    }

    const anchor = toDate(event.startDate || event.dueDate || event.endDate);
    return anchor ? isSameDay(anchor, day) : false;
  });

export default function WeekCalendarView({ currentDate, events, onDayClick }: WeekCalendarViewProps) {
  const start = startOfWeek(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, idx) => addDays(start, idx));

  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-white">
      <div className="grid grid-cols-7 border-b border-[#EAECF0]">
        {weekDays.map((day, idx) => (
          <div key={day.toISOString()} className="px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-[#667085]">{DAY_NAMES[idx]}</div>
            <div className="text-sm font-semibold text-[#101828]">{day.getDate()}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {weekDays.map((day) => {
          const dayEvents = eventsForDay(events, day);

          return (
            <div key={day.toISOString()} className={`min-h-[340px] border-r border-[#F2F4F7] p-2 align-top${onDayClick ? ' cursor-pointer hover:bg-[#F9FAFB]' : ''}`} onClick={() => onDayClick?.(day)}>
              <div className="space-y-1.5">
                {dayEvents.map((event) => (
                  <CalendarEventCard key={`${event.id}-${day.toDateString()}`} event={event} compact={false} />
                ))}
                {dayEvents.length === 0 && (
                  <div className="rounded-md border border-dashed border-[#E4E7EC] px-2 py-3 text-center text-xs text-[#98A2B3]">
                    No items
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
