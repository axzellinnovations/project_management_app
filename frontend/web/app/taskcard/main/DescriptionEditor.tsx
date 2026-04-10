'use client';
import React, { useEffect, useState } from 'react';
import { Edit2 } from 'lucide-react';

interface DescriptionEditorProps {
  description: string;
  onUpdateDescription?: (description: string) => void;
}

const DescriptionEditor: React.FC<DescriptionEditorProps> = ({ description, onUpdateDescription }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [edited, setEdited] = useState(description);

  useEffect(() => {
    setEdited(description);
  }, [description]);

  const handleSave = () => {
    if (edited !== description) {
      onUpdateDescription?.(edited);
    }
    setIsEditing(false);
  };

  return (
    <div className="mb-8 group">
      <h3 className="text-sm font-bold text-gray-800 mb-2">Description</h3>
      {isEditing ? (
        <div>
          <textarea
            value={edited ?? ''}
            onChange={(e) => setEdited(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setEdited(description);
                setIsEditing(false);
              }
            }}
            autoFocus
            rows={6}
            className="w-full p-4 rounded-md border-2 border-blue-500 text-gray-600 text-sm leading-relaxed focus:outline-none resize-y"
            placeholder="Add a description..."
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSave}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => { setEdited(description); setIsEditing(false); }}
              className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => setIsEditing(true)}
          className="p-4 rounded-md hover:bg-gray-50 border border-transparent hover:border-gray-200 cursor-text transition-all min-h-[100px] text-gray-600 text-sm leading-relaxed relative"
        >
          {description || <span className="text-gray-400 italic">No description provided</span>}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Edit2 size={14} className="text-gray-400" />
          </div>
        </div>
      )}
    </div>
  );
};

export default DescriptionEditor;
