"use client";
import React, { useState, useEffect } from 'react';
import { Paperclip, CheckSquare, Link, Edit2, AlertCircle } from 'lucide-react';
import SubtaskList from './SubtaskList';
import CommentSection from './CommentSection';

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
}

const TaskMainContent: React.FC<TaskMainContentProps> = ({ 
  title, 
  description, 
  subtasks, 
  dependencies, 
  taskId,
  onUpdateTitle,
  onUpdateDescription
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const [editedDescription, setEditedDescription] = useState(description);

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
    <div className="flex-1 overflow-y-auto p-8 border-r border-gray-100 scrollbar-thin scrollbar-thumb-gray-200">
      
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
      <div className="flex gap-3 mb-6">
        <ActionButton icon={<Paperclip size={14} />} label="Attach" />
        <ActionButton icon={<CheckSquare size={14} />} label="Add subtask" />
        <ActionButton icon={<Link size={14} />} label="Link issue" />
      </div>

      {/* Description */}
      <div className="mb-8 group">
        <h3 className="text-sm font-bold text-gray-800 mb-2">Description</h3>
        {isEditingDescription ? (
          <div>
            <textarea
              value={editedDescription}
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
      <SubtaskList subtasks={subtasks} />

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
const ActionButton = ({ icon, label }: { icon: React.ReactNode, label: string }) => (
  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium text-gray-700 transition-colors">
    {icon} {label}
  </button>
);

export default TaskMainContent;