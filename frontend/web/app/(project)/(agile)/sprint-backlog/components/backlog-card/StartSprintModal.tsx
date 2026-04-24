'use client';

import { useState } from 'react';
import { CalendarDays, Clock, Rocket, X } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface StartSprintModalProps {
  open: boolean;
  sprintName: string;
  loading: boolean;
  error: string;
  onStart: (durationDays: number, startDate?: string) => void;
  onCancel: () => void;
}

const DURATION_PRESETS = [
  { label: '1 Week', days: 7 },
  { label: '2 Weeks', days: 14 },
  { label: '3 Weeks', days: 21 },
  { label: '1 Month', days: 30 },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function StartSprintModal({ open, sprintName, loading, error, onStart, onCancel }: StartSprintModalProps) {
  const [selectedDuration, setSelectedDuration] = useState<number>(14);
  const [customDuration, setCustomDuration] = useState<string>('');
  const [useCustomDuration, setUseCustomDuration] = useState(false);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);

  if (!open) return null;

  const getEffectiveDuration = () => {
    if (useCustomDuration) {
      const val = parseInt(customDuration);
      return isNaN(val) || val <= 0 ? 0 : val;
    }
    return selectedDuration;
  };

  const getPreviewDates = () => {
    const duration = getEffectiveDuration();
    const startObj = new Date(startDate);
    // Use UTC for date manipulation to avoid timezone issues when displaying
    const start = new Date(startObj.getTime() + startObj.getTimezoneOffset() * 60000);
    const end = new Date(start.getTime());
    end.setDate(start.getDate() + duration);
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return { start: fmt(start), end: fmt(end) };
  };

  const duration = getEffectiveDuration();

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(16, 24, 40, 0.55)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl border border-[#E4E7EC] bg-white shadow-2xl"
        style={{ animation: 'modalSlideIn 0.22s cubic-bezier(0.34,1.56,0.64,1) both' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-[#F2F4F7]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#175CD3] to-[#2E90FA] shadow-md">
              <Rocket size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-[#101828] leading-tight">Start Sprint</h2>
              <p className="text-[13px] text-[#667085] mt-0.5">{sprintName}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg p-1.5 text-[#98A2B3] hover:text-[#344054] hover:bg-[#F2F4F7] transition-all duration-150"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Description */}
          <p className="text-[13.5px] text-[#475467] leading-relaxed">
            Set the sprint duration and start date.
          </p>

          {/* Start Date */}
          <div>
            <label className="block text-[12px] font-semibold text-[#344054] uppercase tracking-wider mb-2">
              Start Date
            </label>
            <div className="relative flex-1">
              <CalendarDays size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3] pointer-events-none" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border pl-9 pr-3 py-2.5 text-[14px] text-[#101828] outline-none transition-all duration-150 border-[#D0D5DD] hover:border-[#98A2B3] focus:border-[#175CD3] focus:ring-2 focus:ring-[#175CD3]/20"
              />
            </div>
          </div>

          {/* Preset chips */}
          <div>
            <label className="block text-[12px] font-semibold text-[#344054] uppercase tracking-wider mb-2.5">
              Quick Select
            </label>
            <div className="grid grid-cols-4 gap-2">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset.days}
                  type="button"
                  onClick={() => { setSelectedDuration(preset.days); setUseCustomDuration(false); }}
                  className={`rounded-lg border px-2 py-2.5 text-[12.5px] font-semibold transition-all duration-150 ${
                    !useCustomDuration && selectedDuration === preset.days
                      ? 'border-[#175CD3] bg-[#EFF8FF] text-[#175CD3] shadow-sm ring-1 ring-[#175CD3]/30'
                      : 'border-[#D0D5DD] bg-white text-[#344054] hover:border-[#98A2B3] hover:bg-[#F9FAFB]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom duration */}
          <div>
            <label className="block text-[12px] font-semibold text-[#344054] uppercase tracking-wider mb-2">
              Custom Duration
            </label>
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <Clock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
                <input
                  type="number"
                  min="1"
                  max="365"
                  placeholder="Enter days..."
                  value={customDuration}
                  onChange={(e) => {
                    setCustomDuration(e.target.value);
                    setUseCustomDuration(true);
                  }}
                  onFocus={() => setUseCustomDuration(true)}
                  className={`w-full rounded-lg border pl-9 pr-14 py-2.5 text-[14px] text-[#101828] outline-none transition-all duration-150 ${
                    useCustomDuration
                      ? 'border-[#175CD3] ring-2 ring-[#175CD3]/20'
                      : 'border-[#D0D5DD] hover:border-[#98A2B3]'
                  }`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#98A2B3] font-medium">days</span>
              </div>
            </div>
          </div>

          {/* Date preview */}
          {duration > 0 && (() => {
            const { start, end } = getPreviewDates();
            return (
              <div className="flex items-center gap-3 rounded-xl border border-[#E4E7EC] bg-[#F8F9FB] px-4 py-3">
                <CalendarDays size={16} className="text-[#667085] flex-shrink-0" />
                <div className="text-[13px] text-[#475467]">
                  <span className="font-semibold text-[#101828]">{start}</span>
                  <span className="mx-1.5 text-[#98A2B3]">→</span>
                  <span className="font-semibold text-[#101828]">{end}</span>
                  <span className="ml-2 text-[#667085]">({duration} {duration === 1 ? 'day' : 'days'})</span>
                </div>
              </div>
            );
          })()}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-[#FDA29B] bg-[#FEF3F2] px-3.5 py-3">
              <span className="mt-0.5 shrink-0 text-[#D92D20]">⚠</span>
              <p className="text-[13px] text-[#B42318] leading-snug">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-[#F2F4F7] px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-[#D0D5DD] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#344054] hover:bg-[#F9FAFB] transition-all duration-150 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onStart(duration, startDate)}
            disabled={loading || duration <= 0}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#175CD3] to-[#2E90FA] px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-sm hover:from-[#1849A9] hover:to-[#1570EF] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Rocket size={15} />
                Start Sprint
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalSlideIn {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to   { opacity: 1; transform: scale(1)   translateY(0); }
        }
      `}</style>
    </div>
  );
}
