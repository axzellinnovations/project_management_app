'use client';

import React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  return <DropdownMenuPrimitive.Root>{children}</DropdownMenuPrimitive.Root>;
}

export const DropdownMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Trigger>
>(({ className = '', ...props }, ref) => (
  <DropdownMenuPrimitive.Trigger ref={ref} className={className} {...props} />
));
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';

export function DropdownMenuContent({
  children,
  className = '',
  align = 'start',
  sideOffset = 4,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={[
          'z-50 min-w-[180px] bg-cu-bg rounded-cu-lg shadow-cu-lg border border-cu-border p-1',
          'animate-fade-in',
          className,
        ].join(' ')}
        {...props}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
}

export const DropdownMenuItem = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    destructive?: boolean;
  }
>(({ className = '', destructive, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={[
      'flex items-center gap-2 px-2.5 py-1.5 rounded-cu-md text-sm cursor-pointer outline-none',
      'transition-colors duration-fast',
      destructive
        ? 'text-cu-danger focus:bg-cu-danger-light'
        : 'text-cu-text-primary focus:bg-cu-bg-secondary',
      className,
    ].join(' ')}
    {...props}
  />
));
DropdownMenuItem.displayName = 'DropdownMenuItem';

export function DropdownMenuSeparator({ className = '' }: { className?: string }) {
  return (
    <DropdownMenuPrimitive.Separator
      className={`h-px bg-cu-border my-1 ${className}`}
    />
  );
}

export function DropdownMenuLabel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <DropdownMenuPrimitive.Label
      className={`px-2.5 py-1 text-xs font-medium text-cu-text-tertiary ${className}`}
    >
      {children}
    </DropdownMenuPrimitive.Label>
  );
}
