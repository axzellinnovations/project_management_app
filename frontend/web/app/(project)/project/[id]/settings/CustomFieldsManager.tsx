'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, GripVertical, ChevronDown } from 'lucide-react';
import api from '@/lib/axios';
import { toast } from '@/components/ui';
import type { CustomField } from '@/types';

interface Props {
  projectId: number;
}

const FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'SELECT'] as const;

export default function CustomFieldsManager({ projectId }: Props) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<typeof FIELD_TYPES[number]>('TEXT');
  const [newOptions, setNewOptions] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/api/projects/${projectId}/custom-fields`);
      setFields(res.data);
    } catch {
      toast('Failed to load custom fields', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const options = newType === 'SELECT'
        ? newOptions.split(',').map((o) => o.trim()).filter(Boolean)
        : [];
      await api.post(`/api/projects/${projectId}/custom-fields`, {
        name: newName.trim(),
        fieldType: newType,
        options,
        position: fields.length,
      });
      toast('Custom field created', 'success');
      setShowForm(false);
      setNewName('');
      setNewType('TEXT');
      setNewOptions('');
      await load();
    } catch {
      toast('Failed to create field', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (fieldId: number) => {
    if (!confirm('Delete this custom field? All stored values will be removed.')) return;
    try {
      await api.delete(`/api/projects/${projectId}/custom-fields/${fieldId}`);
      toast('Field deleted', 'success');
      setFields((prev) => prev.filter((f) => f.id !== fieldId));
    } catch {
      toast('Failed to delete field', 'error');
    }
  };

  if (loading) return <div className="text-sm text-gray-500 py-4">Loading fields…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Custom Fields</h3>
          <p className="text-sm text-gray-500 mt-0.5">Add extra fields to all tasks in this project.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={15} />
          Add field
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Field Name</label>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Customer, Budget…"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <div className="relative">
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as typeof FIELD_TYPES[number])}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
          {newType === 'SELECT' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Options (comma-separated)</label>
              <input
                value={newOptions}
                onChange={(e) => setNewOptions(e.target.value)}
                placeholder="Option A, Option B, Option C"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleCreate}
              disabled={saving || !newName.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Create field'}
            </button>
            <button
              onClick={() => { setShowForm(false); setNewName(''); setNewType('TEXT'); setNewOptions(''); }}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Fields list */}
      {fields.length === 0 ? (
        <div className="text-sm text-gray-400 py-4 text-center border border-dashed border-gray-200 rounded-lg">
          No custom fields yet. Click &ldquo;Add field&rdquo; to get started.
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
          {fields.map((field) => (
            <div key={field.id} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors">
              <GripVertical size={16} className="text-gray-300 flex-shrink-0 cursor-grab" />
              <div className="flex-1 min-w-0">
                <span className="font-medium text-gray-800 text-sm">{field.name}</span>
                <span className="ml-2 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                  {field.fieldType}
                </span>
                {field.options && field.options.length > 0 && (
                  <span className="ml-2 text-xs text-gray-400">
                    {field.options.join(', ')}
                  </span>
                )}
              </div>
              <button
                onClick={() => handleDelete(field.id)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                title="Delete field"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
