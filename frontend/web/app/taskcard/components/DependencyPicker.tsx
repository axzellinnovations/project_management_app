'use client';
import React, { useEffect, useState } from 'react';
import api from '@/lib/axios';

interface ProjectTask {
  id: number;
  title: string;
}

interface DependencyPickerProps {
  taskId: number;
  projectId: number;
  existingDependencyIds: number[];
  onLinked: () => void;
  onCancel: () => void;
}

const DependencyPicker: React.FC<DependencyPickerProps> = ({
  taskId,
  projectId,
  existingDependencyIds,
  onLinked,
  onCancel,
}) => {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get<ProjectTask[]>(`/api/tasks/project/${projectId}`)
      .then((r) => setTasks(r.data))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  const filtered = tasks.filter(
    (t) =>
      t.id !== taskId &&
      !existingDependencyIds.includes(t.id) &&
      t.title.toLowerCase().includes(query.toLowerCase()),
  );

  const handleSelect = async (blocker: ProjectTask) => {
    setLinking(true);
    try {
      await api.post(`/api/tasks/${taskId}/dependencies/${blocker.id}`);
      onLinked();
    } catch {
      // 409 = already linked — treat as success
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="border border-blue-200 rounded-lg p-3 bg-blue-50">
      <input
        autoFocus
        type="text"
        placeholder="Search tasks to link..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 bg-white mb-2"
      />
      {loading && <p className="text-xs text-gray-400 px-1">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <p className="text-xs text-gray-400 px-1">No matching tasks found</p>
      )}
      <div className="max-h-40 overflow-y-auto space-y-1">
        {filtered.map((t) => (
          <button
            key={t.id}
            onClick={() => !linking && void handleSelect(t)}
            disabled={linking}
            className="w-full text-left px-3 py-2 rounded hover:bg-white text-sm text-gray-700 transition-colors flex items-center gap-2"
          >
            <span className="text-xs text-gray-400 shrink-0">TASK-{t.id}</span>
            <span className="truncate">{t.title}</span>
          </button>
        ))}
      </div>
      <button
        onClick={onCancel}
        className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline"
      >
        Cancel
      </button>
    </div>
  );
};

export default DependencyPicker;
