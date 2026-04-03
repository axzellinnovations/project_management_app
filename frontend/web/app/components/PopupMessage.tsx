'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type PopupType = 'success' | 'error' | 'warning' | 'info';

interface PopupMessageProps {
  isOpen: boolean;
  type: PopupType;
  title: string;
  message: string;
  onClose: () => void;
  duration?: number; // Auto close after ms (0 = no auto-close)
  action?: {
    label: string;
    onClick: () => void;
  };
}

const typeConfig = {
  success: {
    icon: CheckCircle2,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    titleColor: 'text-green-900',
    messageColor: 'text-green-700',
    iconColor: 'text-green-600',
    actionBg: 'bg-green-600 hover:bg-green-700',
  },
  error: {
    icon: AlertCircle,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    titleColor: 'text-red-900',
    messageColor: 'text-red-700',
    iconColor: 'text-red-600',
    actionBg: 'bg-red-600 hover:bg-red-700',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    titleColor: 'text-yellow-900',
    messageColor: 'text-yellow-700',
    iconColor: 'text-yellow-600',
    actionBg: 'bg-yellow-600 hover:bg-yellow-700',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    titleColor: 'text-blue-900',
    messageColor: 'text-blue-700',
    iconColor: 'text-blue-600',
    actionBg: 'bg-blue-600 hover:bg-blue-700',
  },
};

export default function PopupMessage({
  isOpen,
  type,
  title,
  message,
  onClose,
  duration = 5000,
  action,
}: PopupMessageProps) {
  const [visible, setVisible] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  const config = typeConfig[type];
  const IconComponent = config.icon;

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setVisible(false);
      onClose();
    }, 300);
  }, [onClose]);

  useEffect(() => {
    setVisible(isOpen);
    setIsClosing(false);

    if (isOpen && duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, handleClose]);

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black transition-opacity duration-300 z-40 ${
          isClosing ? 'opacity-0' : 'opacity-20'
        }`}
        onClick={handleClose}
      />

      {/* Popup Container */}
      <div
        className={`
          fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
          z-50 transition-all duration-300 scale-100
          ${isClosing ? 'scale-90 opacity-0' : 'scale-100 opacity-100'}
        `}
      >
        {/* Card */}
        <div
          className={`
            w-full max-w-md rounded-xl border-2 shadow-2xl
            ${config.bgColor} ${config.borderColor}
            overflow-hidden
          `}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 pb-4">
            <div className="flex items-start gap-4 flex-1">
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  type === 'success'
                    ? 'bg-green-100'
                    : type === 'error'
                      ? 'bg-red-100'
                      : type === 'warning'
                        ? 'bg-yellow-100'
                        : 'bg-blue-100'
                }`}
              >
                <IconComponent className={`w-6 h-6 ${config.iconColor}`} />
              </div>

              <div className="flex-1">
                <h3 className={`text-lg font-bold ${config.titleColor}`}>
                  {title}
                </h3>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={handleClose}
              className={`flex-shrink-0 p-1 rounded-full transition-colors hover:bg-white/50 active:scale-90 ${config.messageColor}`}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Message */}
          <div className="px-6 pb-6">
            <p className={`text-sm leading-relaxed ${config.messageColor}`}>
              {message}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 px-6 pb-6 pt-2">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors active:scale-95"
            >
              Close
            </button>

            {action && (
              <button
                onClick={() => {
                  action.onClick();
                  handleClose();
                }}
                className={`flex-1 px-4 py-2.5 rounded-lg text-white font-medium text-sm transition-colors active:scale-95 ${config.actionBg}`}
              >
                {action.label}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
