'use client';

import { useState } from 'react';

interface Props {
  onClose: () => void;
}

export default function CreateTaskModal({ onClose }: Props) {
  const [taskName, setTaskName] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">

      <div className="w-[400px] rounded-xl bg-white p-6 shadow-lg">

        <h2 className="mb-4 text-lg font-semibold">Create Task</h2>

        <input
          type="text"
          placeholder="Enter task name..."
          value={taskName}
          onChange={(e) => setTaskName(e.target.value)}
          className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm"
          >
            Cancel
          </button>

          <button
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Create
          </button>
        </div>

      </div>
    </div>
  );
}