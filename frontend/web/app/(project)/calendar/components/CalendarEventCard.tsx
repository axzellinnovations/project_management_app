import type { CalendarEventItem } from '../types';

interface CalendarEventCardProps {
  event: CalendarEventItem;
  compact?: boolean;
  isRangeSegmentStart?: boolean;
  isRangeSegmentEnd?: boolean;
  /** When true the parent already handles width/position — disables bleed offsets */
  positioned?: boolean;
  onClick?: (event: CalendarEventItem, clientX: number, clientY: number) => void;
  onDragStart?: (eventId: string) => void;
  isDragging?: boolean;
}

export default function CalendarEventCard({
  event,
  compact = false,
  isRangeSegmentStart = true,
  isRangeSegmentEnd = true,
  positioned = false,
  onClick,
  onDragStart,
  isDragging = false,
}: CalendarEventCardProps) {
  const sprint = event.kind === 'sprint';
  const draggable = !sprint && event.taskId != null;

  const leftBorderClass = isRangeSegmentStart ? 'border-l' : 'border-l-0';
  const rightBorderClass = isRangeSegmentEnd ? 'border-r' : 'border-r-0';
  const rangeRound = `${isRangeSegmentStart ? 'rounded-l-md' : ''} ${isRangeSegmentEnd ? 'rounded-r-md' : ''}`.trim();
  const isRangeSegment = !isRangeSegmentStart || !isRangeSegmentEnd;
  const bleedClass = positioned
    ? 'w-full h-full'
    : isRangeSegment
      ? `${isRangeSegmentStart ? 'w-[calc(100%+9px)]' : isRangeSegmentEnd ? 'w-[calc(100%+9px)] -ml-[9px]' : 'w-[calc(100%+18px)] -ml-[9px]'}`
      : 'w-full';
  const taskClasses = `block ${bleedClass} px-2 py-1 text-xs text-[#101828] bg-[#F2F4F7] border border-[#E4E7EC] ${leftBorderClass} ${rightBorderClass} ${rangeRound || 'rounded-md'} ${onClick ? 'cursor-pointer hover:bg-[#EAECF0]' : ''} ${draggable ? 'cursor-grab' : ''}`;
  const sprintClasses = `block ${bleedClass} px-2 py-1 text-xs font-semibold text-[#175CD3] bg-[#DFF3FF] border border-[#B2DDFF] ${leftBorderClass} ${rightBorderClass} ${rangeRound} ${onClick ? 'cursor-pointer hover:brightness-95' : ''}`;

  return (
    <div
      title={`${event.title}${event.status ? ` - ${event.status}` : ''}`}
      draggable={draggable}
      onDragStart={draggable && onDragStart ? (e) => { e.stopPropagation(); onDragStart(event.id); } : undefined}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(event, e.clientX, e.clientY); } : undefined}
      className={[
        sprint ? sprintClasses : taskClasses,
        isDragging ? 'opacity-40' : '',
      ].join(' ')}
    >
      <div className="truncate">{event.title}</div>
      {!compact && !sprint && event.assignee && (
        <div className="truncate text-[10px] text-[#667085]">{event.assignee}</div>
      )}
    </div>
  );
}
