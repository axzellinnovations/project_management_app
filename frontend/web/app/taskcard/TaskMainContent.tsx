"use client";
import React from 'react';
import { Paperclip, CheckSquare, Link, Edit2, AlertCircle } from 'lucide-react';
import SubtaskList from './SubtaskList';
import CommentSection from './CommentSection';

interface Dependency {
  id: string;
  title: string;
  relation: string;
}

interface TaskMainContentProps {
  title: string;
  description: string;
  subtasks: any[];
  dependencies: Dependency[];
}

const TaskMainContent: React.FC<TaskMainContentProps> = ({ title, description, subtasks, dependencies }) => {
  return (
    <div className="flex-1 overflow-y-auto p-8 border-r border-gray-100 scrollbar-thin scrollbar-thumb-gray-200">
      
      {/* Title */}
      <div className="group mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 hover:bg-gray-50 p-1 rounded -ml-1 cursor-text transition-colors">
          {title}
        </h1>
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
        <div className="p-4 rounded-md hover:bg-gray-50 border border-transparent hover:border-gray-200 cursor-text transition-all min-h-[100px] text-gray-600 text-sm leading-relaxed relative">
          {description}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Edit2 size={14} className="text-gray-400" />
          </div>
        </div>
      </div>

      {/* Subtasks Component */}
      <SubtaskList subtasks={subtasks} />

      {/* Linked Issues (Dependencies) */}
      {dependencies.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Linked Issues</h3>
          {dependencies.map((dep) => (
            <div key={dep.id} className="flex items-center gap-3 p-2 border border-gray-100 rounded mb-2 hover:bg-gray-50 transition-colors">
              <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-1 rounded">
                {dep.relation}
              </span>
              <div className="flex items-center gap-2 flex-1">
                <AlertCircle size={16} className="text-red-500" />
                <span className="text-sm text-gray-400 font-medium line-through decoration-gray-400">{dep.id}</span>
                <span className="text-sm text-gray-600 hover:text-blue-600 cursor-pointer">{dep.title}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comments Component */}
      <CommentSection />
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