'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, Trash2, X } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ConfirmModalProps {
  open: boolean;
  variant: 'danger' | 'warning' | 'success';
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ConfirmModal({
  open,
  variant,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  const variantConfig = {
    danger: {
      iconBg: 'bg-[#FEF3F2]',
      iconColor: 'text-[#D92D20]',
      icon: <Trash2 size={22} />,
      btnClass: 'bg-[#D92D20] hover:bg-[#B42318] text-white',
      borderColor: 'border-[#FDA29B]',
    },
    warning: {
      iconBg: 'bg-[#FFFAEB]',
      iconColor: 'text-[#B54708]',
      icon: <AlertTriangle size={22} />,
      btnClass: 'bg-[#DC6803] hover:bg-[#B54708] text-white',
      borderColor: 'border-[#FEDF89]',
    },
    success: {
      iconBg: 'bg-[#ECFDF3]',
      iconColor: 'text-[#027A48]',
      icon: <CheckCircle2 size={22} />,
      btnClass: 'bg-[#039855] hover:bg-[#027A48] text-white',
      borderColor: 'border-[#A6F4C5]',
    },
  };

  const cfg = variantConfig[variant];

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(16, 24, 40, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl border border-[#E4E7EC] bg-white shadow-2xl"
        style={{ animation: 'confirmSlideIn 0.2s cubic-bezier(0.34,1.56,0.64,1) both' }}
      >
        {/* Close */}
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-lg p-1 text-[#98A2B3] hover:text-[#344054] hover:bg-[#F2F4F7] transition-all duration-150"
        >
          <X size={16} />
        </button>

        <div className="p-6">
          {/* Icon */}
          <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl border ${cfg.borderColor} ${cfg.iconBg} ${cfg.iconColor}`}>
            {cfg.icon}
          </div>

          {/* Title & Message */}
          <h3 className="text-[16px] font-bold text-[#101828] mb-1">{title}</h3>
          <p className="text-[13.5px] text-[#475467] leading-relaxed">{message}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-[#F2F4F7] px-6 py-4">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-[#D0D5DD] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#344054] hover:bg-[#F9FAFB] transition-all duration-150 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13.5px] font-semibold shadow-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${cfg.btnClass}`}
          >
            {loading && <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
            {confirmLabel}
          </button>
        </div>

        <style>{`
          @keyframes confirmSlideIn {
            from { opacity: 0; transform: scale(0.92) translateY(10px); }
            to   { opacity: 1; transform: scale(1)   translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
}
