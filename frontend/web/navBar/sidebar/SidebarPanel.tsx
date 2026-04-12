'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface SidebarPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  badge?: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
  anchorLeft: number; // left position = sidebar right edge
}

export function SidebarPanel({ open, onClose, title, badge, children, footer, anchorLeft }: SidebarPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  /* Click outside */
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      const handler = (e: MouseEvent) => {
        const target = e.target as Node;
        if (panelRef.current && !panelRef.current.contains(target)) {
          const inSidebar = (target as Element)?.closest?.('[data-sidebar-panel-trigger]');
          if (!inSidebar) onClose();
        }
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }, 50);
    return () => clearTimeout(id);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          data-sidebar-panel
          initial={{ opacity: 0, x: -12, scale: 0.97 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -12, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 420, damping: 30, mass: 0.7 }}
          className="fixed z-[10000] flex flex-col bg-white border border-cu-border rounded-xl shadow-2xl shadow-black/15 overflow-hidden"
          style={{
            top: 8,
            left: anchorLeft + 8,
            width: 280,
            maxHeight: 'calc(100dvh - 16px)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-cu-border-light shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-cu-text-primary tracking-tight">{title}</span>
              {typeof badge === 'number' && badge > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold leading-none">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-cu-text-muted hover:text-cu-text-primary hover:bg-cu-hover transition-colors"
              aria-label="Close panel"
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="border-t border-cu-border-light px-4 py-2.5 bg-[#FAFBFC] shrink-0">
              {footer}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
