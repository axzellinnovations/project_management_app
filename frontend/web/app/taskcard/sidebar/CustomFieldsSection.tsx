'use client';
import React, { useEffect, useState } from 'react';
import api from '@/lib/axios';
import SidebarField from './SidebarField';
import type { CustomField } from '@/types';

interface CustomFieldsSectionProps {
  taskId: number;
  projectId: number;
  readOnly?: boolean;
}

const inputClass = 'w-full text-sm border border-[#E5E7EB] rounded-lg px-2.5 h-11 sm:h-9 focus:outline-none focus:ring-2 focus:ring-[#155DFC]/30 focus:border-[#155DFC] bg-white';

const CustomFieldsSection: React.FC<CustomFieldsSectionProps> = ({ taskId, projectId, readOnly = false }) => {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [values, setValues] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!projectId) return;
    // Parallel fetch: field definitions and task-specific values are independent requests
    Promise.all([
      api.get<CustomField[]>(`/api/projects/${projectId}/custom-fields`),
      api.get<Record<number, string>>(`/api/tasks/${taskId}/custom-field-values`),
    ]).then(([fieldsRes, valuesRes]) => {
      setFields(fieldsRes.data);
      setValues(valuesRes.data ?? {});
    }).catch(() => {});
  }, [taskId, projectId]);

  const saveValue = async (fieldId: number, value: string) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    await api.put(`/api/tasks/${taskId}/custom-field-values`, { customFieldId: fieldId, value }).catch(() => {});
  };

  if (fields.length === 0) return null;

  return (
    <div className="space-y-3 border-t border-[#EAECF0] pt-4 mt-2">
      <span className="text-[10px] font-bold text-[#6A7282] uppercase tracking-wider">Custom Fields</span>
      {fields.map((field) => (
        <SidebarField key={field.id} label={field.name}>
          {field.fieldType === 'SELECT' ? (
            <select
              value={values[field.id] ?? ''}
              onChange={(e) => void saveValue(field.id, e.target.value)}
              disabled={readOnly}
              className={inputClass}
            >
              <option value="">— none —</option>
              {(field.options ?? []).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : field.fieldType === 'DATE' ? (
            <input
              type="date"
              value={values[field.id] ?? ''}
              onChange={(e) => void saveValue(field.id, e.target.value)}
              disabled={readOnly}
              className={inputClass}
            />
          ) : (
            <input
              type={field.fieldType === 'NUMBER' ? 'number' : 'text'}
              defaultValue={values[field.id] ?? ''}
              // Key includes the current value so React re-mounts this input when the value is updated externally
              key={`${field.id}-${values[field.id]}`}
              onBlur={(e) => {
                const next = e.target.value;
                // Save on blur only when the value actually changed to avoid redundant API calls
                if (next !== (values[field.id] ?? '')) void saveValue(field.id, next);
              }}
              disabled={readOnly}
              placeholder="—"
              className={inputClass}
            />
          )}
        </SidebarField>
      ))}
    </div>
  );
};

export default CustomFieldsSection;
