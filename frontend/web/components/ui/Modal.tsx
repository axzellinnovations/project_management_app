'use client';

import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const sizeClasses: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  full: 'max-w-[90vw] max-h-[90vh]',
};

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className = '',
  size = 'md',
}: ModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          className={[
            'fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2',
            'bg-cu-bg rounded-cu-xl shadow-cu-xl border border-cu-border',
            'data-[state=open]:animate-fade-in',
            'focus:outline-none',
            sizeClasses[size],
            className,
          ].join(' ')}
        >
          {(title || description) && (
            <div className="flex items-start justify-between px-6 pt-6 pb-2">
              <div>
                {title && (
                  <DialogPrimitive.Title className="text-md font-semibold text-cu-text-primary">
                    {title}
                  </DialogPrimitive.Title>
                )}
                {description && (
                  <DialogPrimitive.Description className="mt-1 text-sm text-cu-text-secondary">
                    {description}
                  </DialogPrimitive.Description>
                )}
              </div>
              <DialogPrimitive.Close className="rounded-cu-md p-1.5 text-cu-text-tertiary hover:bg-cu-bg-secondary hover:text-cu-text-primary transition-colors">
                <X size={18} />
              </DialogPrimitive.Close>
            </div>
          )}
          <div className="px-6 pb-6">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const ModalTrigger = DialogPrimitive.Trigger;
export const ModalClose = DialogPrimitive.Close;
