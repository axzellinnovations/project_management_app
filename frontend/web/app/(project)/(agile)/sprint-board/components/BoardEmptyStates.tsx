'use client';

import { AlertCircle, CheckCircle2, Loader } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface BoardEmptyStatesProps {
  type: 'missing-project' | 'loading-agile' | 'not-agile' | 'loading' | 'error' | 'no-sprint';
  error?: string | null;
  projectIdStr?: string | null;
  onRetry?: () => void;
  onGoToBacklog?: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function BoardEmptyStates({ type, error, projectIdStr, onRetry, onGoToBacklog }: BoardEmptyStatesProps) {
  if (type === 'missing-project') {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center">
        <div className="text-center p-8 bg-white rounded-2xl shadow-xl max-w-sm">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#101828]">Missing Project</h2>
          <p className="text-[#475467] text-sm mt-2">Please select a project to view its sprint board.</p>
        </div>
      </div>
    );
  }

  if (type === 'loading-agile') {
    return <div className="flex-1 flex items-center justify-center"><Loader className="w-8 h-8 text-[#155DFC] animate-spin" /></div>;
  }

  if (type === 'not-agile') {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50 h-full">
        <div className="text-center p-10 bg-white rounded-3xl shadow-sm border border-[#EAECF0] max-w-lg">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6"><AlertCircle className="w-8 h-8 text-[#155DFC]" /></div>
          <h2 className="text-2xl font-bold text-[#101828]">Kanban Projects don&apos;t have Sprints</h2>
          <p className="text-[#475467] mt-3">The Sprint Board is exclusive to <span className="font-bold text-[#155DFC]">Agile</span> projects.</p>
        </div>
      </div>
    );
  }

  if (type === 'loading') {
    return <div className="flex-1 flex items-center justify-center"><Loader className="w-8 h-8 text-[#155DFC] animate-spin" /></div>;
  }

  if (type === 'error') {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-[#101828]">Sprint Board not ready</h2>
          <p className="text-[#475467] text-sm mt-2 mb-6">{error}</p>
          <button onClick={onRetry} className="px-4 py-2 bg-white border border-[#EAECF0] rounded-xl text-sm font-semibold hover:bg-gray-50 shadow-sm">Try Again</button>
        </div>
      </div>
    );
  }

  // no-sprint
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle2 className="w-10 h-10 text-gray-300" /></div>
        <h2 className="text-xl font-bold text-[#101828]">No active sprint</h2>
        <p className="text-[#475467] text-sm mt-2">
          <button onClick={onGoToBacklog} className="text-[#155DFC] font-semibold hover:underline">Start a sprint</button> in the backlog.
        </p>
      </div>
    </div>
  );
}
