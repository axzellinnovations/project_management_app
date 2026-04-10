'use client';

import type { ReactNode } from 'react';

interface EmptyStateProps {
    /** Lucide icon or any SVG/element */
    icon?: ReactNode;
    title: string;
    subtitle?: string;
    action?: ReactNode;
    /** Extra className on the root wrapper */
    className?: string;
}

export default function EmptyState({
    icon,
    title,
    subtitle,
    action,
    className = '',
}: EmptyStateProps) {
    return (
        <div
            className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}
        >
            {icon && (
                <div className="mb-4 flex items-center justify-center w-14 h-14 rounded-2xl bg-[#F3F4F6] text-[#9CA3AF]">
                    {icon}
                </div>
            )}
            <p className="text-[15px] font-semibold text-[#101828] mb-1">{title}</p>
            {subtitle && (
                <p className="text-[13px] text-[#6A7282] max-w-[280px] leading-relaxed">
                    {subtitle}
                </p>
            )}
            {action && <div className="mt-5">{action}</div>}
        </div>
    );
}
