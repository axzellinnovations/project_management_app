'use client';

interface CompleteSprintModalProps {
  open: boolean;
  allActiveSprints: Array<{ id: number; sprintName?: string }>;
  sprintIdToComplete: number | null;
  onSelectSprint: (id: number) => void;
  onComplete: () => void;
  onCancel: () => void;
}

export default function CompleteSprintModal({ open, allActiveSprints, sprintIdToComplete, onSelectSprint, onComplete, onCancel }: CompleteSprintModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#EAECF0] p-6 max-w-md w-full">
        <h3 className="text-lg font-bold text-[#101828] mb-4">Complete Sprint</h3>
        <div className="space-y-2">
          {allActiveSprints.map((s) => (
            <button key={s.id} onClick={() => onSelectSprint(s.id)}
              className={`w-full text-left p-3 rounded-xl border ${sprintIdToComplete === s.id ? 'border-[#155DFC] bg-blue-50' : 'border-[#EAECF0]'}`}
            >
              {s.sprintName || `Sprint #${s.id}`}
            </button>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-xl border border-[#D0D5DD] px-3 py-2 text-sm">Cancel</button>
          <button onClick={onComplete} className="flex-1 rounded-xl bg-[#D92D20] px-3 py-2 text-sm text-white">Complete</button>
        </div>
      </div>
    </div>
  );
}
