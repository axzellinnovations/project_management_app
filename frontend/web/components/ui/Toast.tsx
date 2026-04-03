'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={18} className="text-cu-success" />,
  error: <AlertCircle size={18} className="text-cu-danger" />,
  warning: <AlertTriangle size={18} className="text-cu-warning" />,
  info: <Info size={18} className="text-cu-info" />,
};

const bgMap: Record<ToastType, string> = {
  success: 'border-cu-success/30 bg-cu-success-light',
  error: 'border-cu-danger/30 bg-cu-danger-light',
  warning: 'border-cu-warning/30 bg-cu-warning-light',
  info: 'border-cu-info/30 bg-cu-info-light',
};

// Global toast state
let addToastFn: ((toast: Omit<ToastItem, 'id'>) => void) | null = null;

export function toast(message: string, type: ToastType = 'info', duration?: number) {
  addToastFn?.({ message, type, duration });
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => {
      addToastFn = null;
    };
  }, [addToast]);

  return (
    <>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
        <AnimatePresence>
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}

function ToastItem({
  toast: t,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(t.id), t.duration || 3000);
    return () => clearTimeout(timer);
  }, [t.id, t.duration, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`flex items-start gap-2.5 px-4 py-3 rounded-cu-lg border shadow-cu-md ${bgMap[t.type]}`}
    >
      <span className="mt-0.5 shrink-0">{iconMap[t.type]}</span>
      <p className="text-sm text-cu-text-primary flex-1">{t.message}</p>
      <button
        onClick={() => onDismiss(t.id)}
        className="shrink-0 text-cu-text-tertiary hover:text-cu-text-primary transition-colors"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}
