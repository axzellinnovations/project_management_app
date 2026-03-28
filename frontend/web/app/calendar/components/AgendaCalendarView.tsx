import CalendarEventCard from './CalendarEventCard';
import type { CalendarEventItem } from '../types';
import { addDays, isDateInRange, isSameDay, startOfDay, toDate } from '../utils/date';

interface AgendaCalendarViewProps {
  currentDate: Date;
  events: CalendarEventItem[];
}

const AGENDA_SPAN_DAYS = 14;

export default function AgendaCalendarView({ currentDate, events }: AgendaCalendarViewProps) {
  const start = startOfDay(currentDate);
  const days = Array.from({ length: AGENDA_SPAN_DAYS }, (_, idx) => addDays(start, idx));

  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-white">
      <div className="border-b border-[#EAECF0] px-4 py-3 text-sm font-semibold text-[#344054]">
        Agenda ({AGENDA_SPAN_DAYS} days)
      </div>

      <div className="max-h-[650px] overflow-y-auto">
        {days.map((day) => {
          const dayEvents = events.filter((event) => {
            if (event.kind === 'sprint') {
              return isDateInRange(day, event.startDate, event.endDate);
            }

            const anchor = toDate(event.startDate || event.dueDate || event.endDate);
            return anchor ? isSameDay(anchor, day) : false;
          });

          return (
            <div key={day.toISOString()} className="border-b border-[#F2F4F7] px-4 py-3">
              <div className="mb-2 text-sm font-semibold text-[#101828]">
                {day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </div>

              <div className="space-y-1.5">
                {dayEvents.length > 0 ? (
                  dayEvents.map((event) => (
                    <CalendarEventCard key={`${event.id}-${day.toDateString()}`} event={event} />
                  ))
                ) : (
                  <div className="text-xs text-[#98A2B3]">No events</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
