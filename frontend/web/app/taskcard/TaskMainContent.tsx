'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Paperclip, CheckSquare, Link, AlertCircle, Loader2 } from 'lucide-react';
import SubtaskList from './SubtaskList';
import CommentSection from './CommentSection';
import DescriptionEditor from './main/DescriptionEditor';
import AttachmentsPanel from './main/AttachmentsPanel';
import { useTaskAttachments } from '@/hooks/useTaskAttachments';
import api from '@/lib/axios';

interface Dependency {
  id: number;
  title: string;
  relation: string;
}

interface ProjectTask {
  id: number;
  title: string;
}

interface TaskMainContentProps {
  title: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subtasks: any[];
  dependencies: Dependency[];
  taskId?: number;
  projectId?: number;
  onUpdateTitle?: (title: string) => void;
  onUpdateDescription?: (description: string) => void;
  onSubtaskAdded?: () => void;
  onDependencyChanged?: () => void;
}

const TaskMainContent: React.FC<TaskMainContentProps> = ({ 
  title, 
  description, 
  subtasks, 
  dependencies, 
  taskId,
  projectId,
  onUpdateTitle,
  onUpdateDescription,
  onSubtaskAdded,
  onDependencyChanged,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const [subtaskAddTrigger, setSubtaskAddTrigger] = useState(0);
  const [showDependencyPicker, setShowDependencyPicker] = useState(false);
  const attachInputRef = useRef<HTMLInputElement>(null);

  const { attachments, isUploading, error: attachError, uploadFile, removeFile } = useTaskAttachments(taskId);

  useEffect(() => {
    setEditedTitle(title);
  }, [title]);

  const handleTitleSave = () => {
    if (editedTitle.trim() && editedTitle !== title) {
      onUpdateTitle?.(editedTitle.trim());
    }
    setIsEditingTitle(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 md:p-8 border-r border-gray-100 scrollbar-thin scrollbar-thumb-gray-200 min-h-0">
      
      {/* Title */}
      <div className="group mb-6">
        {isEditingTitle ? (
          <input
            type="text"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleSave();
              if (e.key === 'Escape') {
                setEditedTitle(title);
                setIsEditingTitle(false);
              }
            }}
            autoFocus
            className="w-full text-2xl font-semibold text-gray-900 bg-white border-2 border-blue-500 rounded px-2 py-1 focus:outline-none"
          />
        ) : (
          <h1 
            onClick={() => setIsEditingTitle(true)}
            className="text-2xl font-semibold text-gray-900 hover:bg-gray-50 p-1 rounded -ml-1 cursor-text transition-colors"
          >
            {title}
          </h1>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap gap-2 mb-6">
        <ActionButton
          icon={isUploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
          label={isUploading ? 'Uploading...' : 'Attach'}
          onClick={() => !isUploading && attachInputRef.current?.click()}
        />
        <input
          ref={attachInputRef}
          type="file"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
              await uploadFile(file);
              e.target.value = '';
            }
          }}
        />
        <ActionButton
          icon={<CheckSquare size={14} />}
          label="Add subtask"
          onClick={() => setSubtaskAddTrigger(n => n + 1)}
        />
        <ActionButton icon={<Link size={14} />} label="Link issue" onClick={() => setShowDependencyPicker(true)} />
      </div>
      {attachError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded mb-4">{attachError}</p>
      )}

      <AttachmentsPanel attachments={attachments} onRemove={removeFile} />

      <DescriptionEditor description={description} onUpdateDescription={onUpdateDescription} />

      {/* Subtasks Component */}
      <SubtaskList
        subtasks={subtasks}
        taskId={taskId}
        onSubtaskAdded={onSubtaskAdded}
        addTrigger={subtaskAddTrigger}
      />

      {/* Linked Issues (Dependencies) */}
      {(dependencies && dependencies.length > 0 || showDependencyPicker) && (
        <div className="mb-8">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Linked Issues</h3>
          {dependencies.map((dep) => (
            <div key={dep.id} className="flex items-center gap-3 p-2 border border-gray-100 rounded mb-2 hover:bg-gray-50 transition-colors group">
              <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-1 rounded">
                {dep.relation}
              </span>
              <div className="flex items-center gap-2 flex-1">
                <AlertCircle size={16} className="text-red-500" />
                <button
                  className="text-sm text-blue-600 hover:underline font-medium"
                  onClick={() => {
                    const url = new URL(window.location.href);
                    url.searchParams.set('taskId', String(dep.id));
                    window.history.pushState({}, '', url.toString());
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                >
                  TASK-{dep.id}
                </button>
                <span className="text-sm text-gray-600">{dep.title}</span>
              </div>
              <button
                onClick={async () => {
                  if (!taskId) return;
                  try {
                    await api.delete(`/api/tasks/${taskId}/dependencies/${dep.id}`);
                    onDependencyChanged?.();
                  } catch {
                    // silently fail; parent will keep current deps
                  }
                }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                title="Remove dependency"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          ))}
          {showDependencyPicker && taskId && projectId && (
            <DependencyPicker
              taskId={taskId}
              projectId={projectId}
              existingDependencyIds={dependencies.map((d) => d.id)}
              onLinked={() => { onDependencyChanged?.(); setShowDependencyPicker(false); }}
              onCancel={() => setShowDependencyPicker(false)}
            />
          )}
        </div>
      )}
      {showDependencyPicker && (!dependencies || dependencies.length === 0) && taskId && projectId && (
        <div className="mb-8">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Linked Issues</h3>
          <DependencyPicker
            taskId={taskId}
            projectId={projectId}
            existingDependencyIds={[]}
            onLinked={() => { onDependencyChanged?.(); setShowDependencyPicker(false); }}
            onCancel={() => setShowDependencyPicker(false)}
          />
        </div>
      )}

      {/* Comments Component */}
      <CommentSection taskId={taskId} />
    </div>
  );
};

// Small helper component for the top buttons
const ActionButton = ({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium text-gray-700 transition-colors"
  >
    {icon} {label}
  </button>
);

// Inline dependency picker: fetches project tasks and lets user link one
const DependencyPicker = ({
  taskId, projectId, existingDependencyIds, onLinked, onCancel,
}: {
  taskId: number;
  projectId: number;
  existingDependencyIds: number[];
  onLinked: () => void;
  onCancel: () => void;
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
    (t) => t.id !== taskId && !existingDependencyIds.includes(t.id) &&
      t.title.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = async (blocker: ProjectTask) => {
    setLinking(true);
    try {
      await api.post(`/api/tasks/${taskId}/dependencies/${blocker.id}`);
      onLinked();
    } catch {
      // ignore — API may return 409 if already linked
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
      {!loading && filtered.length === 0 && <p className="text-xs text-gray-400 px-1">No matching tasks found</p>}
      <div className="max-h-40 overflow-y-auto space-y-1">
        {filtered.map((t) => (
          <button
            key={t.id}
            onClick={() => !linking && handleSelect(t)}
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

export default TaskMainContent;