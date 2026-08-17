'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Edit2, Loader2, Plus, Search, Tag, Trash2, X } from 'lucide-react';
import { getProjectLabels, createLabel, updateLabel, deleteLabel } from '@/services/labels-service';
import type { Label } from '@/types';

// ── 12-color palette ────────────────────────────────────────────────────────
export const LABEL_PALETTE = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16',
  '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6',
  '#6366F1', '#8B5CF6', '#EC4899', '#6B7280',
];

function randomColor(): string {
  return LABEL_PALETTE[Math.floor(Math.random() * LABEL_PALETTE.length)];
}

/** Returns inline styles for a colored label pill */
export function hexToLabelStyle(hex?: string | null): React.CSSProperties {
  const color = hex && hex.startsWith('#') ? hex : (hex ? `#${hex}` : '#6366F1');
  return { backgroundColor: color + '22', color };
}

export interface LabelPickerProps {
  projectId: number;
  selectedLabels: Label[];
  onChange: (labels: Label[]) => void;
  disabled?: boolean;
  className?: string;
  buttonLabel?: string;
}

export default function LabelPicker({
  projectId,
  selectedLabels,
  onChange,
  disabled = false,
  className = '',
  buttonLabel = 'Labels',
}: LabelPickerProps) {
  const [open, setOpen] = useState(false);
  const [projectLabels, setProjectLabels] = useState<Label[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  // Search & Create states
  const [inputValue, setInputValue] = useState('');
  const [pickedColor, setPickedColor] = useState<string>(LABEL_PALETTE[0]);
  const [creating, setCreating] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Edit states
  const [editingLabelId, setEditingLabelId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(LABEL_PALETTE[0]);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete states
  const [deletingLabelId, setDeletingLabelId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setEditingLabelId(null);
        setDeletingLabelId(null);
        setShowColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch labels on first open
  useEffect(() => {
    if (!open || loaded || !projectId) return;
    setLoading(true);
    getProjectLabels(projectId)
      .then((labels) => {
        setProjectLabels(labels || []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true))
      .finally(() => setLoading(false));
  }, [open, loaded, projectId]);

  const isSelected = (id: number) => selectedLabels.some((l) => l.id === id);

  const toggle = (label: Label) => {
    if (editingLabelId || deletingLabelId) return;
    if (isSelected(label.id)) {
      onChange(selectedLabels.filter((l) => l.id !== label.id));
    } else {
      onChange([...selectedLabels, label]);
    }
  };

  const handleCreate = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || creating || !projectId) return;
    setCreating(true);
    try {
      const created = await createLabel(projectId, trimmed, pickedColor || randomColor());
      setProjectLabels((prev) => [...prev, created]);
      onChange([...selectedLabels, created]);
      setInputValue('');
      setPickedColor(LABEL_PALETTE[Math.floor(Math.random() * LABEL_PALETTE.length)]);
      setShowColorPicker(false);
    } catch (err) {
      console.error('Failed to create label:', err);
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (e: React.MouseEvent, label: Label) => {
    e.stopPropagation();
    setEditingLabelId(label.id);
    setEditName(label.name);
    setEditColor(label.color || LABEL_PALETTE[0]);
    setDeletingLabelId(null);
  };

  const cancelEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingLabelId(null);
    setEditName('');
  };

  const handleSaveEdit = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!editingLabelId || !editName.trim() || savingEdit) return;
    setSavingEdit(true);
    try {
      const updated = await updateLabel(editingLabelId, editName.trim(), editColor);
      setProjectLabels((prev) =>
        prev.map((l) => (l.id === editingLabelId ? updated : l))
      );
      // Update in selectedLabels if it was selected
      if (selectedLabels.some((l) => l.id === editingLabelId)) {
        onChange(
          selectedLabels.map((l) => (l.id === editingLabelId ? updated : l))
        );
      }
      setEditingLabelId(null);
    } catch (err) {
      console.error('Failed to update label:', err);
    } finally {
      setSavingEdit(false);
    }
  };

  const startDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setDeletingLabelId(id);
    setEditingLabelId(null);
  };

  const cancelDelete = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeletingLabelId(null);
  };

  const handleConfirmDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteLabel(id);
      setProjectLabels((prev) => prev.filter((l) => l.id !== id));
      if (selectedLabels.some((l) => l.id === id)) {
        onChange(selectedLabels.filter((l) => l.id !== id));
      }
      setDeletingLabelId(null);
    } catch (err) {
      console.error('Failed to delete label:', err);
    } finally {
      setDeleting(false);
    }
  };

  const filteredLabels = useMemo(() => {
    if (!inputValue.trim()) return projectLabels;
    const term = inputValue.toLowerCase().trim();
    return projectLabels.filter((l) => l.name.toLowerCase().includes(term));
  }, [projectLabels, inputValue]);

  const exactMatchExists = useMemo(() => {
    const term = inputValue.toLowerCase().trim();
    return projectLabels.some((l) => l.name.toLowerCase() === term);
  }, [projectLabels, inputValue]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-cu-border text-[12px] text-[#374151] dark:text-cu-text-primary hover:border-[#155DFC] hover:text-[#155DFC] dark:hover:border-cu-primary dark:hover:text-cu-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-cu-bg shadow-sm"
      >
        <Tag size={13} />
        {buttonLabel}
        {selectedLabels.length > 0 && (
          <span className="ml-0.5 bg-[#155DFC] text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5 leading-none">
            {selectedLabels.length}
          </span>
        )}
      </button>

      {/* Selected label chips (shown outside dropdown) */}
      {selectedLabels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selectedLabels.map((l) => (
            <span
              key={l.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={hexToLabelStyle(l.color)}
            >
              {l.name}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange(selectedLabels.filter((s) => s.id !== l.id))}
                  className="opacity-70 hover:opacity-100 transition-opacity"
                  aria-label={`Remove label ${l.name}`}
                >
                  <X size={10} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-[var(--cu-z-dropdown,50)] w-72 bg-white dark:bg-cu-bg rounded-xl border border-[#E5E7EB] dark:border-cu-border shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search / Create Bar */}
          <div className="p-2.5 border-b border-[#F3F4F6] dark:border-cu-border bg-[#F9FAFB] dark:bg-cu-bg-secondary/40 space-y-2">
            <div className="flex items-center gap-1.5 bg-white dark:bg-cu-bg border border-[#E5E7EB] dark:border-cu-border rounded-lg px-2 py-1 focus-within:border-[#155DFC] focus-within:ring-1 focus-within:ring-[#155DFC]/20 transition-all">
              <Search size={13} className="text-gray-400 dark:text-cu-text-muted shrink-0" />
              <input
                autoFocus
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (inputValue.trim() && !exactMatchExists) {
                      void handleCreate();
                    }
                  }
                }}
                placeholder="Search or new label…"
                className="flex-1 text-[12px] bg-transparent outline-none text-[#101828] dark:text-cu-text-primary placeholder-[#9CA3AF] dark:placeholder-cu-text-muted min-w-0"
              />
              {/* Color swatch picker trigger */}
              <button
                type="button"
                onClick={() => setShowColorPicker((p) => !p)}
                title="Select label color"
                className="w-4 h-4 rounded-full border border-black/10 dark:border-white/10 shrink-0 hover:scale-110 transition-transform shadow-xs"
                style={{ backgroundColor: pickedColor }}
              />
              {inputValue.trim() && !exactMatchExists && (
                <button
                  type="button"
                  onClick={() => void handleCreate()}
                  disabled={creating}
                  title="Create label"
                  className="p-1 rounded-md bg-[#155DFC] text-white disabled:opacity-40 hover:bg-[#0042A8] transition-colors shrink-0 flex items-center justify-center"
                >
                  {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                </button>
              )}
            </div>

            {/* Color palette selector for new label */}
            {showColorPicker && (
              <div className="p-1.5 bg-white dark:bg-cu-bg border border-[#E5E7EB] dark:border-cu-border rounded-lg shadow-xs">
                <p className="text-[10px] font-semibold text-gray-500 dark:text-cu-text-muted uppercase tracking-wider mb-1 px-1">
                  Choose Color
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {LABEL_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setPickedColor(c);
                        setShowColorPicker(false);
                      }}
                      className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${
                        pickedColor === c ? 'ring-2 ring-offset-1 ring-[#155DFC] scale-110' : ''
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Labels List */}
          <div className="max-h-60 overflow-y-auto p-1 divide-y divide-gray-50 dark:divide-cu-border/40">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-gray-400 dark:text-cu-text-muted">
                <Loader2 size={14} className="animate-spin text-[#155DFC]" />
                <span>Loading labels…</span>
              </div>
            ) : filteredLabels.length === 0 ? (
              <div className="py-5 px-3 text-center">
                <p className="text-[12px] text-gray-500 dark:text-cu-text-muted">
                  {inputValue.trim()
                    ? `No labels matching "${inputValue}"`
                    : 'No labels yet for this project.'}
                </p>
                {inputValue.trim() && !exactMatchExists && (
                  <button
                    type="button"
                    onClick={() => void handleCreate()}
                    disabled={creating}
                    className="mt-2 text-[11px] font-semibold text-[#155DFC] dark:text-cu-primary hover:underline inline-flex items-center gap-1"
                  >
                    <Plus size={11} /> Create &quot;{inputValue.trim()}&quot;
                  </button>
                )}
              </div>
            ) : (
              filteredLabels.map((label) => {
                const active = isSelected(label.id);
                const isEditing = editingLabelId === label.id;
                const isDeleting = deletingLabelId === label.id;

                // Inline Edit Mode
                if (isEditing) {
                  return (
                    <div
                      key={label.id}
                      className="p-2 bg-blue-50/50 dark:bg-cu-primary/10 rounded-lg space-y-2 my-0.5 border border-blue-200/60 dark:border-cu-primary/30"
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: editColor }}
                        />
                        <input
                          autoFocus
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void handleSaveEdit();
                            }
                            if (e.key === 'Escape') {
                              cancelEdit();
                            }
                          }}
                          placeholder="Label name"
                          className="flex-1 text-[12px] px-2 py-1 bg-white dark:bg-cu-bg border border-gray-200 dark:border-cu-border rounded outline-none focus:border-[#155DFC] text-gray-800 dark:text-cu-text-primary"
                        />
                        <button
                          type="button"
                          onClick={(e) => void handleSaveEdit(e)}
                          disabled={!editName.trim() || savingEdit}
                          title="Save changes"
                          className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors"
                        >
                          {savingEdit ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          title="Cancel"
                          className="p-1 rounded bg-gray-200 dark:bg-cu-bg-secondary text-gray-700 dark:text-cu-text-secondary hover:bg-gray-300 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>

                      {/* Color Palette for Edit */}
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {LABEL_PALETTE.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setEditColor(c)}
                            className={`w-4 h-4 rounded-full transition-transform hover:scale-110 ${
                              editColor === c ? 'ring-2 ring-offset-1 ring-[#155DFC] scale-110' : ''
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                }

                // Inline Delete Confirmation Mode
                if (isDeleting) {
                  return (
                    <div
                      key={label.id}
                      className="p-2 bg-red-50/80 dark:bg-red-950/30 rounded-lg flex items-center justify-between gap-2 my-0.5 border border-red-200 dark:border-red-800/40"
                    >
                      <span className="text-[11px] font-medium text-red-700 dark:text-red-400 truncate">
                        Delete &quot;{label.name}&quot;?
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => void handleConfirmDelete(e, label.id)}
                          disabled={deleting}
                          className="px-2 py-0.5 text-[11px] font-semibold bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          {deleting ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={cancelDelete}
                          className="px-2 py-0.5 text-[11px] font-medium bg-gray-200 dark:bg-cu-bg-secondary text-gray-700 dark:text-cu-text-secondary rounded hover:bg-gray-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                }

                // Normal Label Row with Selection & Action Buttons
                return (
                  <div
                    key={label.id}
                    className={`group flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-cu-hover transition-colors ${
                      active ? 'bg-[#155DFC]/5 dark:bg-cu-primary/10' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(label)}
                      className="flex-1 flex items-center gap-2 text-left min-w-0 py-0.5"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: label.color || '#6366F1' }}
                      />
                      <span
                        className={`text-[12px] truncate ${
                          active
                            ? 'font-semibold text-[#155DFC] dark:text-cu-primary'
                            : 'text-gray-700 dark:text-cu-text-primary'
                        }`}
                      >
                        {label.name}
                      </span>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      {active && (
                        <Check size={13} className="text-[#155DFC] dark:text-cu-primary mr-1" />
                      )}

                      {/* Edit Label Button */}
                      <button
                        type="button"
                        onClick={(e) => startEdit(e, label)}
                        title={`Edit "${label.name}"`}
                        aria-label={`Edit label ${label.name}`}
                        className="p-1 text-gray-400 hover:text-[#155DFC] dark:hover:text-cu-primary hover:bg-white dark:hover:bg-cu-bg rounded opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                      >
                        <Edit2 size={11} />
                      </button>

                      {/* Delete Label Button */}
                      <button
                        type="button"
                        onClick={(e) => startDelete(e, label.id)}
                        title={`Delete "${label.name}"`}
                        aria-label={`Delete label ${label.name}`}
                        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-white dark:hover:bg-cu-bg rounded opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
