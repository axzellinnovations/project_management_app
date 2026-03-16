import type { CalendarEventItem } from '../types';

interface CalendarEventCardProps {
  event: CalendarEventItem;
  compact?: boolean;
  isSprintSegmentStart?: boolean;
  isSprintSegmentEnd?: boolean;
}

export default function CalendarEventCard({
  event,
  compact = false,
  isSprintSegmentStart = true,
  isSprintSegmentEnd = true,
}: CalendarEventCardProps) {
  const sprint = event.kind === 'sprint';

  const sprintRound = `${isSprintSegmentStart ? 'rounded-l-md' : ''} ${isSprintSegmentEnd ? 'rounded-r-md' : ''}`;

  return (
    <div
      title={`${event.title}${event.status ? ` - ${event.status}` : ''}`}
      className={
        sprint
          ? `px-2 py-1 text-xs font-semibold text-[#175CD3] bg-[#DFF3FF] border border-[#B2DDFF] ${sprintRound}`
          : `px-2 py-1 text-xs text-[#101828] bg-[#F2F4F7] border border-[#E4E7EC] rounded-md`
      }
    >
      <div className="truncate">{event.title}</div>
      {!compact && !sprint && event.assignee && (
        <div className="truncate text-[10px] text-[#667085]">{event.assignee}</div>
      )}
    </div>
  );
}
