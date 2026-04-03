import { useState } from 'react';
import { PopupType } from '@/app/components/PopupMessage';

export interface PopupConfig {
  type: PopupType;
  title: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function usePopup() {
  const [popup, setPopup] = useState<PopupConfig | null>(null);

  const show = (config: PopupConfig) => {
    setPopup(config);
  };

  const showSuccess = (
    title: string,
    message: string,
    duration = 5000,
    action?: PopupConfig['action']
  ) => {
    show({ type: 'success', title, message, duration, action });
  };

  const showError = (
    title: string,
    message: string,
    duration = 6000,
    action?: PopupConfig['action']
  ) => {
    show({ type: 'error', title, message, duration, action });
  };

  const showWarning = (
    title: string,
    message: string,
    duration = 5000,
    action?: PopupConfig['action']
  ) => {
    show({ type: 'warning', title, message, duration, action });
  };

  const showInfo = (
    title: string,
    message: string,
    duration = 5000,
    action?: PopupConfig['action']
  ) => {
    show({ type: 'info', title, message, duration, action });
  };

  const close = () => {
    setPopup(null);
  };

  return {
    popup,
    show,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    close,
  };
}
