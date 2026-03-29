import CalendarEventCard from './CalendarEventCard';
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
}

const getEventsForDate = (events: CalendarEventItem[], day: Date) =>
  events.filter((event) => {
    if (event.kind === 'sprint') {
      return isDateInRange(day, event.startDate, event.endDate);
    }

    const exact = toDate(event.startDate || event.dueDate || event.endDate);
    return exact ? isSameDay(day, exact) : false;
  });

export default function MonthCalendarView({ currentDate, events }: MonthCalendarViewProps) {
  const start = startOfMonthGrid(currentDate);
  const end = endOfMonthGrid(currentDate);

  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    days.push(new Date(d));
  }

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

          return (
            <div
              key={`${day.toISOString()}-${idx}`}
              className="min-h-[130px] border-b border-r border-[#F2F4F7] p-2"
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
    </div>
  );
}
