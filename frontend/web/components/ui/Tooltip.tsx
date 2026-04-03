'use client';

import React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

export interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  delayDuration?: number;
}

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export function Tooltip({ children, content, side = 'top', delayDuration = 200 }: TooltipProps) {
  return (
    <TooltipPrimitive.Root delayDuration={delayDuration}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={4}
          className={[
            'z-50 px-2.5 py-1.5 rounded-cu-md text-xs font-medium',
            'bg-cu-sidebar text-white shadow-cu-md',
            'animate-fade-in',
          ].join(' ')}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-cu-sidebar" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
