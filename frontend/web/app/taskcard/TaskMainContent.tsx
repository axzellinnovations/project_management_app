'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Paperclip, CheckSquare, Link, AlertCircle, Loader2 } from 'lucide-react';
import SubtaskList from './SubtaskList';
import CommentSection from './CommentSection';
import DescriptionEditor from './main/DescriptionEditor';
import AttachmentsPanel from './main/AttachmentsPanel';
import { useTaskAttachments } from '@/hooks/useTaskAttachments';
import api from '@/lib/axios';
import TaskActionButton from './components/TaskActionButton';
import DependencyPicker from './components/DependencyPicker';

interface Dependency {
  id: number;
  title: string;
  relation: string;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSubtaskAdded?: (subtask: any) => void;
  onDependencyChanged?: () => void;
  readOnly?: boolean;
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
  readOnly = false,
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
    <div className="flex-1 min-h-0 overflow-visible md:overflow-y-auto p-4 sm:p-5 md:p-6 border-r-0 md:border-r border-[#EAECF0] scrollbar-thin scrollbar-thumb-[#E5E7EB]">
      
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
            className="w-full text-[22px] font-bold text-[#101828] bg-white border-2 border-[#155DFC] rounded-lg px-2 py-1 focus:outline-none font-outfit tracking-tight"
          />
        ) : (
          <h1 
            onClick={() => !readOnly && setIsEditingTitle(true)}
            className="text-[22px] font-bold text-[#101828] tracking-tight hover:bg-[#F8FAFF] px-2 py-1 rounded-lg -ml-2 cursor-text transition-colors font-outfit"
          >
            {title}
          </h1>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap gap-2 mb-6">
        <TaskActionButton
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
        <TaskActionButton
          icon={<CheckSquare size={14} />}
          label="Add subtask"
          onClick={() => !readOnly && setSubtaskAddTrigger(n => n + 1)}
        />
        <TaskActionButton icon={<Link size={14} />} label="Link issue" onClick={() => !readOnly && setShowDependencyPicker(true)} />
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
                  if (readOnly) return;
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
                disabled={readOnly}
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



export default TaskMainContent;