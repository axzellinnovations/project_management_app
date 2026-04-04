"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Paperclip, CheckSquare, Link, Edit2, AlertCircle, Download, Trash2, FileText, Image, File as FileIcon, Loader2 } from 'lucide-react';
import SubtaskList from './SubtaskList';
import CommentSection from './CommentSection';
import { useTaskAttachments } from '@/hooks/useTaskAttachments';

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
  onUpdateTitle?: (title: string) => void;
  onUpdateDescription?: (description: string) => void;
  onSubtaskAdded?: () => void;
}

const TaskMainContent: React.FC<TaskMainContentProps> = ({ 
  title, 
  description, 
  subtasks, 
  dependencies, 
  taskId,
  onUpdateTitle,
  onUpdateDescription,
  onSubtaskAdded,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const [editedDescription, setEditedDescription] = useState(description);
  const [subtaskAddTrigger, setSubtaskAddTrigger] = useState(0);
  const attachInputRef = useRef<HTMLInputElement>(null);

  // Attachment management via dedicated hook
  const { attachments, isUploading, error: attachError, uploadFile, removeFile } = useTaskAttachments(taskId);

  // Update local state when props change
  useEffect(() => {
    setEditedTitle(title);
  }, [title]);

  useEffect(() => {
    setEditedDescription(description);
  }, [description]);

  const handleTitleSave = () => {
    if (editedTitle.trim() && editedTitle !== title) {
      onUpdateTitle?.(editedTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const handleDescriptionSave = () => {
    if (editedDescription !== description) {
      onUpdateDescription?.(editedDescription);
    }
    setIsEditingDescription(false);
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
        <ActionButton icon={<Link size={14} />} label="Link issue" />
      </div>
      {attachError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded mb-4">{attachError}</p>
      )}

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Attachments</h3>
          <div className="space-y-2">
            {attachments.map((att) => (
              <div key={att.id} className="flex items-center gap-3 p-2.5 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors group">
                <AttachmentIcon contentType={att.contentType} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{att.fileName}</p>
                  <p className="text-xs text-gray-400">{formatFileSize(att.fileSize)} · {att.uploadedByName}</p>
                </div>
                <a
                  href={att.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                  title="Download"
                >
                  <Download size={14} />
                </a>
                <button
                  onClick={() => removeFile(att.id)}
                  className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      <div className="mb-8 group">
        <h3 className="text-sm font-bold text-gray-800 mb-2">Description</h3>
        {isEditingDescription ? (
          <div>
            <textarea
              value={editedDescription ?? ''}
              onChange={(e) => setEditedDescription(e.target.value)}
              onBlur={handleDescriptionSave}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setEditedDescription(description);
                  setIsEditingDescription(false);
                }
              }}
              autoFocus
              rows={6}
              className="w-full p-4 rounded-md border-2 border-blue-500 text-gray-600 text-sm leading-relaxed focus:outline-none resize-y"
              placeholder="Add a description..."
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleDescriptionSave}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditedDescription(description);
                  setIsEditingDescription(false);
                }}
                className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div 
            onClick={() => setIsEditingDescription(true)}
            className="p-4 rounded-md hover:bg-gray-50 border border-transparent hover:border-gray-200 cursor-text transition-all min-h-[100px] text-gray-600 text-sm leading-relaxed relative"
          >
            {description || <span className="text-gray-400 italic">No description provided</span>}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Edit2 size={14} className="text-gray-400" />
            </div>
          </div>
        )}
      </div>

      {/* Subtasks Component */}
      <SubtaskList
        subtasks={subtasks}
        taskId={taskId}
        onSubtaskAdded={onSubtaskAdded}
        addTrigger={subtaskAddTrigger}
      />

      {/* Linked Issues (Dependencies) */}
      {dependencies && dependencies.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Linked Issues</h3>
          {dependencies.map((dep) => (
            <div key={dep.id} className="flex items-center gap-3 p-2 border border-gray-100 rounded mb-2 hover:bg-gray-50 transition-colors">
              <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-1 rounded">
                {dep.relation}
              </span>
              <div className="flex items-center gap-2 flex-1">
                <AlertCircle size={16} className="text-red-500" />
                <span className="text-sm text-gray-400 font-medium line-through decoration-gray-400">TASK-{dep.id}</span>
                <span className="text-sm text-gray-600 hover:text-blue-600 cursor-pointer">{dep.title}</span>
              </div>
            </div>
          ))}
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

// Returns an icon based on file content type
const AttachmentIcon = ({ contentType }: { contentType: string }) => {
  if (contentType.startsWith('image/')) return <Image size={18} className="text-purple-500 shrink-0" />;
  if (contentType === 'application/pdf') return <FileText size={18} className="text-red-500 shrink-0" />;
  return <FileIcon size={18} className="text-blue-500 shrink-0" />;
};

// Format bytes to human-readable size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default TaskMainContent;