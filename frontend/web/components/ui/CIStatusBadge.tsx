'use client';

import React from 'react';
import { CheckCircle2, HelpCircle, Loader2, XCircle } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CIStatus = 'PASSING' | 'FAILED' | 'RUNNING' | 'UNKNOWN';

export interface CIStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** CI pipeline status. Case-insensitive. null/undefined renders nothing. */
  status: CIStatus | string | null | undefined;
  /** Visual size variant. Defaults to 'md'. */
  size?: 'sm' | 'md';
  /** Show the status icon. Defaults to true. */
  showIcon?: boolean;
  /** Show the status label text. Defaults to true. */
  showLabel?: boolean;
}

// ── Config tables ─────────────────────────────────────────────────────────────

interface StatusEntry {
  label: string;
  Icon: React.ElementType;
  badgeCls: string;
  iconCls: string;
  spin: boolean;
  ping: boolean;
}

const STATUS_CONFIG: Record<CIStatus, StatusEntry> = {
  PASSING: {
    label: 'Passing',
    Icon: CheckCircle2,
    badgeCls: 'bg-green-50 text-green-700 border border-green-200',
    iconCls: 'text-green-500',
    spin: false,
    ping: false,
  },
  FAILED: {
    label: 'Failed',
    Icon: XCircle,
    badgeCls: 'bg-red-50 text-red-700 border border-red-200',
    iconCls: 'text-red-500',
    spin: false,
    ping: false,
  },
  RUNNING: {
    label: 'Running',
    Icon: Loader2,
    badgeCls: 'bg-amber-50 text-amber-700 border border-amber-200',
    iconCls: 'text-amber-500',
    spin: true,
    ping: true,
  },
  UNKNOWN: {
    label: 'Unknown',
    Icon: HelpCircle,
    badgeCls: 'bg-gray-50 text-gray-500 border border-gray-200',
    iconCls: 'text-gray-400',
    spin: false,
    ping: false,
  },
};

const SIZE_CONFIG = {
  sm: { pillCls: 'px-1.5 py-0.5 text-[10px] gap-1',   iconSize: 10 },
  md: { pillCls: 'px-2    py-1   text-xs     gap-1.5', iconSize: 12 },
} as const;

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * CIStatusBadge — reusable CI/CD pipeline status pill.
 *
 * Renders nothing when `status` is null or undefined so it is safe to always
 * mount: `<CIStatusBadge status={task.ciStatus} />`.
 *
 * @example
 * // Full badge (default)
 * <CIStatusBadge status="PASSING" />
 *
 * // Compact — icon only, no label
 * <CIStatusBadge status="RUNNING" showLabel={false} size="sm" />
 *
 * // Label only — no icon
 * <CIStatusBadge status="FAILED" showIcon={false} />
 */
const CIStatusBadge = React.forwardRef<HTMLSpanElement, CIStatusBadgeProps>(
  (
    {
      status,
      size = 'md',
      showIcon = true,
      showLabel = true,
      className = '',
      ...props
    },
    ref,
  ) => {
    if (status == null) return null;

    const key = status.toString().toUpperCase() as CIStatus;
    const entry = STATUS_CONFIG[key] ?? STATUS_CONFIG.UNKNOWN;
    const { pillCls, iconSize } = SIZE_CONFIG[size];
    const { Icon, label, badgeCls, iconCls, spin, ping } = entry;

    return (
      <span
        ref={ref}
        role="status"
        aria-label={`CI: ${label}`}
        className={[
          'inline-flex items-center font-semibold whitespace-nowrap rounded-full',
          pillCls,
          badgeCls,
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {showIcon && (
          <Icon
            size={iconSize}
            aria-hidden="true"
            className={`shrink-0 ${iconCls}${spin ? ' animate-spin' : ''}`}
          />
        )}

        {showLabel && <span>{label}</span>}

        {/* Ping indicator — only for RUNNING at md size to avoid clutter */}
        {ping && size === 'md' && (
          <span
            className="relative flex h-1.5 w-1.5 shrink-0"
            aria-hidden="true"
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
          </span>
        )}
      </span>
    );
  },
);

CIStatusBadge.displayName = 'CIStatusBadge';

export { CIStatusBadge };
