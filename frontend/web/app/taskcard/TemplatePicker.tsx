'use client';
import React, { useEffect, useState } from 'react';
import { FileText, X } from 'lucide-react';
import api from '@/lib/axios';
import type { TaskTemplate } from '@/types';

interface TemplatePickerProps {
  projectId: number;
  onApply: (template: TaskTemplate) => void;
  onClose: () => void;
}

const TemplatePicker: React.FC<TemplatePickerProps> = ({ projectId, onApply, onClose }) => {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<TaskTemplate[]>(`/api/projects/${projectId}/templates`)
      .then((r) => setTemplates(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      {/* stopPropagation keeps clicks inside the card from bubbling to the backdrop and closing the picker */}
      <div
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Use a template</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading && (
            <div className="text-center py-8 text-gray-400 text-sm">Loading templates…</div>
          )}
          {!loading && templates.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">
              No templates yet. Save a task as a template to reuse it here.
            </div>
          )}
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => onApply(t)}
              className="w-full flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-blue-50 text-left transition-colors border border-transparent hover:border-blue-200"
            >
              <FileText size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-sm text-gray-800 truncate">{t.name}</div>
                <div className="text-xs text-gray-500 truncate">{t.title}</div>
                {t.description && (
                  <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">{t.description}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TemplatePicker;
