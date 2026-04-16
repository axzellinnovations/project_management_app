"use client";
import React, { useState, useEffect, useRef } from 'react';
import { CheckSquare, Square, Plus, Loader2 } from 'lucide-react';
import api from '@/lib/axios';

interface Subtask {
  id: number;
  title: string;
  status: string;
}

interface SubtaskListProps {
  subtasks: Subtask[];
  taskId?: number;
  onSubtaskAdded?: (subtask: Subtask) => void;
  addTrigger?: number;
}

const SubtaskList: React.FC<SubtaskListProps> = ({ subtasks: initialSubtasks, taskId, onSubtaskAdded, addTrigger }) => {
  const [subtasks, setSubtasks] = useState<Subtask[]>(initialSubtasks);
  const [newTitle, setNewTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggleLoading, setToggleLoading] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync when parent subtasks change (e.g. after parent re-fetch)
  useEffect(() => {
    setSubtasks(initialSubtasks);
  }, [initialSubtasks]);

  // Respond to addTrigger from parent (ActionButton click)
  useEffect(() => {
    if (addTrigger && addTrigger > 0) {
      setIsAdding(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [addTrigger]);

  const completedCount = subtasks.filter(t => t.status?.toUpperCase() === 'DONE').length;
  const progress = subtasks.length > 0 ? (completedCount / subtasks.length) * 100 : 0;

  const handleAddSubtask = async () => {
    if (!newTitle.trim() || !taskId) return;
    try {
      setSaving(true);
      const res = await api.post(`/api/tasks/${taskId}/subtasks`, { title: newTitle.trim(), status: 'TODO' });
      setSubtasks(prev => [...prev, res.data]);
      setNewTitle('');
      setIsAdding(false);
      onSubtaskAdded?.(res.data);
    } catch {
      // keep input open on error
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (st: Subtask) => {
    const isDone = st.status?.toUpperCase() === 'DONE';
    const newStatus = isDone ? 'TODO' : 'DONE';
    setToggleLoading(st.id);
    // optimistic update
    setSubtasks(prev => prev.map(s => s.id === st.id ? { ...s, status: newStatus } : s));
    try {
      await api.patch(`/api/tasks/${st.id}/status`, { status: newStatus });
    } catch {
      // revert on failure
      setSubtasks(prev => prev.map(s => s.id === st.id ? { ...s, status: st.status } : s));
    } finally {
      setToggleLoading(null);
    }
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-[#344054]">Subtasks</h3>
        <div className="flex items-center gap-3">
          {subtasks.length > 0 && (
            <>
              <span className="text-xs text-[#667085]">{completedCount} of {subtasks.length} done</span>
              <div className="w-24 h-1.5 bg-[#EAECF0] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#155DFC] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
          )}
          {taskId && (
            <button
              onClick={() => { setIsAdding(true); setTimeout(() => inputRef.current?.focus(), 50); }}
              className="flex items-center gap-1 text-xs font-semibold text-[#155DFC] hover:text-[#0042A8] transition-colors"
            >
              <Plus size={12} /> Add
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        {subtasks.map((st) => {
          const isDone = st.status?.toUpperCase() === 'DONE';
          return (
            <div
              key={st.id}
              className="flex items-center gap-3 p-2.5 hover:bg-[#F8FAFF] rounded-xl group cursor-pointer border border-[#F2F4F7] hover:border-[#D0D5DD] transition-colors"
              onClick={() => handleToggle(st)}
            >
              {toggleLoading === st.id ? (
                <Loader2 size={16} className="text-blue-500 animate-spin flex-shrink-0" />
              ) : isDone ? (
                <CheckSquare size={16} className="text-green-500 flex-shrink-0" />
              ) : (
                <Square size={16} className="text-gray-400 flex-shrink-0" />
              )}
              <span className={`text-xs font-medium flex-shrink-0 ${isDone ? 'text-[#98A2B3]' : 'text-[#667085]'}`}>
                TASK-{st.id}
              </span>
              <span className={`text-sm flex-1 min-w-0 ${isDone ? 'text-[#98A2B3] line-through' : 'text-[#101828]'}`}>
                {st.title}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${
                isDone ? 'bg-green-100 text-green-700' : 'bg-[#F2F4F7] text-[#667085]'
              }`}>
                {st.status}
              </span>
            </div>
          );
        })}

        {subtasks.length === 0 && !isAdding && (
          <p className="text-sm text-[#98A2B3] pl-1">No subtasks yet</p>
        )}

        {isAdding && (
          <div className="flex items-center gap-2 p-2.5 border border-[#BFDBFE] rounded-xl bg-[#EFF6FF]">
            <Square size={16} className="text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleAddSubtask();
                if (e.key === 'Escape') { setIsAdding(false); setNewTitle(''); }
              }}
              placeholder="Subtask title..."
              className="flex-1 text-sm bg-transparent outline-none text-[#101828] placeholder:text-[#98A2B3]"
              disabled={saving}
            />
            <button
              onClick={() => void handleAddSubtask()}
              disabled={!newTitle.trim() || saving}
              className="px-2.5 py-1.5 text-xs bg-[#155DFC] text-white rounded-lg hover:bg-[#0042A8] disabled:opacity-40 transition-colors flex items-center gap-1 font-semibold"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : null}
              Save
            </button>
            <button
              onClick={() => { setIsAdding(false); setNewTitle(''); }}
              className="px-2.5 py-1.5 text-xs bg-[#F2F4F7] text-[#344054] rounded-lg hover:bg-[#EAECF0] transition-colors font-semibold"
            >
              Cancel
            </button>
          </div>
        )}

        {!isAdding && taskId && subtasks.length > 0 && (
          <button
            onClick={() => { setIsAdding(true); setTimeout(() => inputRef.current?.focus(), 50); }}
            className="mt-1 text-sm text-[#155DFC] hover:text-[#0042A8] pl-2 flex items-center gap-1 transition-colors font-medium"
          >
            <Plus size={13} /> Add subtask
          </button>
        )}
      </div>
    </div>
  );
};

export default SubtaskList;