"use client";
import React, { useState } from 'react';
import { Layout, Link2, MoreHorizontal, X, Check } from 'lucide-react';

interface TaskHeaderProps {
  project: string;
  taskId: string;
  onClose?: () => void;
}

const TaskHeader: React.FC<TaskHeaderProps> = ({ project, taskId, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 bg-white sticky top-0 z-10 flex-shrink-0">
      <div className="flex items-center gap-2 text-sm text-gray-500 min-w-0">
        <Layout size={15} className="text-blue-600 flex-shrink-0" />
        <span className="font-medium text-gray-700 truncate">{project}</span>
        <span className="flex-shrink-0">/</span>
        <span className="text-gray-900 font-medium flex-shrink-0">{taskId}</span>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={handleCopyLink}
          title="Copy link"
          className="p-2 hover:bg-gray-100 rounded flex items-center gap-1.5 text-gray-500 text-xs transition-colors"
        >
          {copied ? <Check size={15} className="text-green-500" /> : <Link2 size={15} />}
          <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy link'}</span>
        </button>
        <button className="p-2 hover:bg-gray-100 rounded text-gray-500 transition-colors" title="More options">
          <MoreHorizontal size={18} />
        </button>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded text-gray-500 transition-colors"
          title="Close"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

export default TaskHeader;