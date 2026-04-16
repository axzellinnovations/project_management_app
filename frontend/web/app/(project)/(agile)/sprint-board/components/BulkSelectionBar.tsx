'use client';

interface BulkSelectionBarProps {
  count: number;
  isBulkApplying: boolean;
  onBulkStatus: (status: string) => void;
  onBulkDelete: () => void;
  onClear: () => void;
}

export default function BulkSelectionBar({ count, isBulkApplying, onBulkStatus, onBulkDelete, onClear }: BulkSelectionBarProps) {
  if (count === 0) return null;
  return (
    <div className="px-4 md:px-6 py-2 border-b border-[#EAECF0] bg-[#F8FAFC] flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-[#344054]">{count} selected</span>
      <button disabled={isBulkApplying} onClick={() => onBulkStatus('TODO')} className="rounded-lg border border-[#D0D5DD] bg-white px-2 py-1 text-xs">To do</button>
      <button disabled={isBulkApplying} onClick={() => onBulkStatus('IN_PROGRESS')} className="rounded-lg border border-[#D0D5DD] bg-white px-2 py-1 text-xs">In progress</button>
      <button disabled={isBulkApplying} onClick={() => onBulkStatus('DONE')} className="rounded-lg border border-[#D0D5DD] bg-white px-2 py-1 text-xs">Done</button>
      <button disabled={isBulkApplying} onClick={onBulkDelete} className="rounded-lg border border-[#F04438] bg-[#FEF3F2] px-2 py-1 text-xs text-[#B42318]">Delete</button>
      <button onClick={onClear} className="rounded-lg border border-[#D0D5DD] bg-white px-2 py-1 text-xs">Clear</button>
    </div>
  );
}
