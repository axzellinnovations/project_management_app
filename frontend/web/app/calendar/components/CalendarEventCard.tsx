import type { CalendarEventItem } from '../types';

interface CalendarEventCardProps {
  event: CalendarEventItem;
  compact?: boolean;
  isSprintSegmentStart?: boolean;
  isSprintSegmentEnd?: boolean;
  onClick?: (event: CalendarEventItem, clientX: number, clientY: number) => void;
}

export default function CalendarEventCard({
  event,
  compact = false,
  isSprintSegmentStart = true,
  isSprintSegmentEnd = true,
  onClick,
}: CalendarEventCardProps) {
  const sprint = event.kind === 'sprint';

  const sprintRound = `${isSprintSegmentStart ? 'rounded-l-md' : ''} ${isSprintSegmentEnd ? 'rounded-r-md' : ''}`;

  return (
    <div
      title={`${event.title}${event.status ? ` - ${event.status}` : ''}`}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(event, e.clientX, e.clientY); } : undefined}
      className={
        sprint
          ? `px-2 py-1 text-xs font-semibold text-[#175CD3] bg-[#DFF3FF] border border-[#B2DDFF] ${sprintRound} ${onClick ? 'cursor-pointer hover:brightness-95' : ''}`
          : `px-2 py-1 text-xs text-[#101828] bg-[#F2F4F7] border border-[#E4E7EC] rounded-md ${onClick ? 'cursor-pointer hover:bg-[#EAECF0]' : ''}`
      }
    >
      <div className="truncate">{event.title}</div>
      {!compact && !sprint && event.assignee && (
        <div className="truncate text-[10px] text-[#667085]">{event.assignee}</div>
      )}
    </div>
  );
}
