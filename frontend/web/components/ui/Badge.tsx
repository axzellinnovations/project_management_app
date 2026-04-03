'use client';

import React from 'react';

const variantClasses: Record<string, string> = {
  default: 'bg-cu-bg-tertiary text-cu-text-secondary',
  primary: 'bg-cu-purple-light text-cu-purple',
  success: 'bg-cu-success-light text-cu-success',
  warning: 'bg-cu-warning-light text-cu-warning',
  danger: 'bg-cu-danger-light text-cu-danger',
  info: 'bg-cu-info-light text-cu-info',
  outline: 'border border-cu-border text-cu-text-secondary bg-transparent',
};

const sizeClasses: Record<string, string> = {
  sm: 'text-2xs px-1.5 py-0.5',
  md: 'text-xs px-2 py-0.5',
  lg: 'text-sm px-2.5 py-1',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variantClasses;
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  dotColor?: string;
  count?: number;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className = '', variant = 'default', size = 'md', dot, dotColor, count, children, ...props }, ref) => {
    const classes = [
      'inline-flex items-center gap-1 font-medium rounded-full whitespace-nowrap',
      variantClasses[variant],
      sizeClasses[size],
      className,
    ].join(' ');

    return (
      <span ref={ref} className={classes} {...props}>
        {dot && (
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={dotColor ? { backgroundColor: dotColor } : undefined}
          />
        )}
        {count !== undefined ? count : children}
      </span>
    );
  }
);
Badge.displayName = 'Badge';

// Status badge with colored dot
export function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string; variant: string }> = {
    TODO: { color: '#D3D3D3', label: 'To Do', variant: 'default' },
    IN_PROGRESS: { color: '#7B68EE', label: 'In Progress', variant: 'primary' },
    IN_REVIEW: { color: '#FF9F43', label: 'In Review', variant: 'warning' },
    DONE: { color: '#6BC950', label: 'Done', variant: 'success' },
  };

  const c = config[status] || config.TODO;
  return (
    <Badge variant={c.variant as keyof typeof variantClasses} dot dotColor={c.color} size="md">
      {c.label}
    </Badge>
  );
}

// Priority badge
export function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, { variant: string; label: string }> = {
    URGENT: { variant: 'danger', label: 'Urgent' },
    HIGH: { variant: 'warning', label: 'High' },
    MEDIUM: { variant: 'primary', label: 'Medium' },
    NORMAL: { variant: 'primary', label: 'Normal' },
    LOW: { variant: 'default', label: 'Low' },
  };

  const c = config[priority] || config.MEDIUM;
  return (
    <Badge variant={c.variant as keyof typeof variantClasses} size="sm">
      {c.label}
    </Badge>
  );
}

export { Badge };
