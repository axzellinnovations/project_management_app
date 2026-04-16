'use client';

import { RotateCcw } from 'lucide-react';

interface UndoMoveToastProps {
  lastMove: { taskId: number; fromStatus: string; toStatus: string } | null;
  onUndo: () => void;
}

export default function UndoMoveToast({ lastMove, onUndo }: UndoMoveToastProps) {
  if (!lastMove) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-[#D0D5DD] bg-white px-4 py-3 shadow-xl">
      <p className="text-xs font-medium text-[#101828]">Moved task to {lastMove.toStatus.replaceAll('_', ' ')}</p>
      <button onClick={onUndo} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#155DFC] hover:underline"><RotateCcw size={12} />Undo</button>
    </div>
  );
}
