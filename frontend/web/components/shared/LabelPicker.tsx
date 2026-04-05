'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Plus, Tag, X } from 'lucide-react';
import { getProjectLabels, createLabel } from '@/services/labels-service';
import type { Label } from '@/types';

// ── 12-color palette ────────────────────────────────────────────────────────
const PALETTE = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16',
  '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6',
  '#6366F1', '#8B5CF6', '#EC4899', '#6B7280',
];

function randomColor(): string {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

/** Returns inline styles for a colored label pill */
export function hexToLabelStyle(hex: string): React.CSSProperties {
  return { backgroundColor: hex + '22', color: hex };
}

interface LabelPickerProps {
  projectId: number;
  selectedLabels: Label[];
  onChange: (labels: Label[]) => void;
}

export default function LabelPicker({ projectId, selectedLabels, onChange }: LabelPickerProps) {
  const [open, setOpen] = useState(false);
  const [projectLabels, setProjectLabels] = useState<Label[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [pickedColor, setPickedColor] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch labels on first open
  useEffect(() => {
    if (!open || loaded) return;
    getProjectLabels(projectId)
      .then((labels) => { setProjectLabels(labels); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [open, loaded, projectId]);

  const isSelected = (id: number) => selectedLabels.some((l) => l.id === id);

  const toggle = (label: Label) => {
    if (isSelected(label.id)) {
      onChange(selectedLabels.filter((l) => l.id !== label.id));
    } else {
      onChange([...selectedLabels, label]);
    }
  };

  const handleCreate = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || creating) return;
    const color = pickedColor ?? randomColor();
    setCreating(true);
    try {
      const created = await createLabel(projectId, trimmed, color);
      setProjectLabels((prev) => [...prev, created]);
      onChange([...selectedLabels, created]);
      setInputValue('');
      setPickedColor(null);
    } catch {
      // silent — label creation failed
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] text-[12px] text-[#374151] hover:border-[#155DFC] hover:text-[#155DFC] transition-colors"
      >
        <Tag size={13} />
        Labels
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
              <button
                type="button"
                onClick={() => onChange(selectedLabels.filter((s) => s.id !== l.id))}
                className="opacity-70 hover:opacity-100"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-[200] w-64 bg-white rounded-xl border border-[#E5E7EB] shadow-lg overflow-hidden">
          {/* Create new label */}
          <div className="p-2 border-b border-[#F3F4F6]">
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleCreate(); } }}
                placeholder="New label name…"
                className="flex-1 text-[12px] px-2.5 py-1.5 border border-[#E5E7EB] rounded-lg outline-none focus:border-[#155DFC] text-[#101828] placeholder-[#9CA3AF]"
              />
              <button
                type="button"
                onClick={void handleCreate}
                disabled={!inputValue.trim() || creating}
                className="p-1.5 rounded-lg bg-[#155DFC] text-white disabled:opacity-40 hover:bg-[#0042A8] transition-colors"
              >
                <Plus size={13} />
              </button>
            </div>
            {/* Color palette */}
            <div className="flex flex-wrap gap-1 mt-2">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPickedColor(c)}
                  className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: pickedColor === c ? '#101828' : 'transparent',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Existing labels */}
          <div className="max-h-48 overflow-y-auto py-1">
            {!loaded ? (
              <p className="text-[12px] text-[#9CA3AF] px-3 py-2">Loading…</p>
            ) : projectLabels.length === 0 ? (
              <p className="text-[12px] text-[#9CA3AF] px-3 py-2">No labels yet — create one above.</p>
            ) : (
              projectLabels.map((label) => (
                <button
                  key={label.id}
                  type="button"
                  onClick={() => toggle(label)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#F9FAFB] transition-colors"
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: label.color }}
                  />
                  <span className="flex-1 text-left text-[12px] text-[#374151] truncate">{label.name}</span>
                  {isSelected(label.id) && <Check size={13} className="text-[#155DFC] shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
