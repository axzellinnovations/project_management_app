'use client';
import React, { useEffect, useState } from 'react';
import { Check, Pencil } from 'lucide-react';
import api from '@/lib/axios';
import SidebarField from './SidebarField';
import type { CustomField, CustomFieldValue } from '@/types';

interface CustomFieldsSectionProps {
  taskId: number;
  projectId: number;
}

const CustomFieldsSection: React.FC<CustomFieldsSectionProps> = ({ taskId, projectId }) => {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [values, setValues] = useState<Record<number, string>>({});
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!projectId) return;
    Promise.all([
      api.get<CustomField[]>(`/api/projects/${projectId}/custom-fields`),
      api.get<CustomFieldValue[]>(`/api/projects/${projectId}/custom-fields/tasks/${taskId}/values`),
    ]).then(([fieldsRes, valuesRes]) => {
      setFields(fieldsRes.data);
      const map: Record<number, string> = {};
      valuesRes.data.forEach((v) => { map[v.customFieldId] = v.value ?? ''; });
      setValues(map);
    }).catch(() => {});
  }, [taskId, projectId]);

  const startEdit = (fieldId: number) => {
    setDraft(values[fieldId] ?? '');
    setEditing(fieldId);
  };

  const saveEdit = async (field: CustomField) => {
    await api.put(`/api/projects/${projectId}/custom-fields/${field.id}/tasks/${taskId}/value`, {
      value: draft,
    });
    setValues((prev) => ({ ...prev, [field.id]: draft }));
    setEditing(null);
  };

  if (fields.length === 0) return null;

  return (
    <div className="space-y-4 border-t border-gray-100 pt-4 mt-2">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Custom Fields</span>
      {fields.map((field) => (
        <SidebarField key={field.id} label={field.name}>
          {editing === field.id ? (
            <div className="flex gap-1 items-center">
              {field.fieldType === 'SELECT' ? (
                <select
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 min-h-[44px] sm:min-h-0"
                >
                  <option value="">— none —</option>
                  {(field.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : field.fieldType === 'DATE' ? (
                <input
                  type="date"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 min-h-[44px] sm:min-h-0"
                />
              ) : (
                <input
                  type={field.fieldType === 'NUMBER' ? 'number' : 'text'}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 min-h-[44px] sm:min-h-0"
                />
              )}
              <button
                onClick={() => saveEdit(field)}
                className="p-1 rounded hover:bg-green-50 text-green-600"
              >
                <Check size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <span className="text-sm text-gray-700 flex-1">
                {values[field.id] || <span className="text-gray-400 italic">—</span>}
              </span>
              <button
                onClick={() => startEdit(field.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all"
              >
                <Pencil size={12} />
              </button>
            </div>
          )}
        </SidebarField>
      ))}
    </div>
  );
};

export default CustomFieldsSection;
