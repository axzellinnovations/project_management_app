"use client";
import React from 'react';
import { Layout, Eye, ThumbsUp, Share2, MoreHorizontal, X } from 'lucide-react';

interface TaskHeaderProps {
  project: string;
  taskId: string;
  onClose?: () => void;
}

const TaskHeader: React.FC<TaskHeaderProps> = ({ project, taskId, onClose }) => {
  return (
    <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100 bg-white sticky top-0 z-10">
      <div className="flex items-center gap-3">
        {/* Breadcrumb / Project Info */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Layout size={16} className="text-blue-600" />
          <span className="font-medium text-gray-700">{project}</span>
          <span>/</span>
          <span className="text-gray-900 font-medium">{taskId}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Jira-style Quick Actions */}
        <div className="flex items-center gap-1 mr-4 border-r border-gray-200 pr-4">
          <button className="p-2 hover:bg-gray-100 rounded flex items-center gap-2 text-gray-600 text-sm transition-colors">
            <Eye size={16} /> <span className="hidden sm:inline">Watch</span>
          </button>
          <button className="p-2 hover:bg-gray-100 rounded flex items-center gap-2 text-gray-600 text-sm transition-colors">
            <ThumbsUp size={16} /> <span className="hidden sm:inline">Vote</span>
          </button>
          <button className="p-2 hover:bg-gray-100 rounded flex items-center gap-2 text-gray-600 text-sm transition-colors">
            <Share2 size={16} /> <span className="hidden sm:inline">Share</span>
          </button>
        </div>

        <button className="p-2 hover:bg-gray-100 rounded text-gray-500 transition-colors">
          <MoreHorizontal size={20} />
        </button>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded text-gray-500 transition-colors"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
};

export default TaskHeader;