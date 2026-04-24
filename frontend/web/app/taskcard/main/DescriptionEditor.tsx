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

  // Sync local edit buffer when the description changes from outside (e.g. parent re-fetch after another user edits)
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
      <h3 className="text-sm font-bold text-[#344054] mb-2">Description</h3>
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
            className="w-full p-4 rounded-xl border-2 border-[#155DFC] text-[#475467] text-sm leading-relaxed focus:outline-none resize-y bg-white shadow-sm"
            placeholder="Add a description..."
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSave}
              className="px-3 py-1.5 bg-[#155DFC] text-white text-sm font-semibold rounded-xl hover:bg-[#0042A8] transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => { setEdited(description); setIsEditing(false); }}
              className="px-3 py-1.5 bg-[#F2F4F7] text-[#344054] text-sm font-semibold rounded-xl hover:bg-[#EAECF0] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => setIsEditing(true)}
          className="p-4 rounded-xl hover:bg-[#F8FAFF] border border-[#EAECF0] hover:border-[#D0D5DD] cursor-text transition-all min-h-[100px] text-[#475467] text-sm leading-relaxed relative"
        >
          {description || <span className="text-[#98A2B3] italic">No description provided</span>}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Edit2 size={14} className="text-gray-400" />
          </div>
        </div>
      )}
    </div>
  );
};

export default DescriptionEditor;
