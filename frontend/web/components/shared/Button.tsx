'use client';
import React from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?:   Variant;
    size?:      Size;
    isLoading?: boolean;
    leftIcon?:  React.ReactNode;
    rightIcon?: React.ReactNode;
}

const BASE =
    'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none';

const VARIANT: Record<Variant, string> = {
    primary:
        'bg-[#155DFC] text-white shadow-sm hover:bg-[#0042a3] active:bg-[#003a94] focus-visible:ring-[#155DFC]',
    secondary:
        'bg-white/10 text-[#1D293D] border border-[#E3E8EF] backdrop-blur hover:bg-white/40 focus-visible:ring-[#155DFC]',
    ghost:
        'text-[#4B5563] hover:bg-gray-100 focus-visible:ring-gray-300',
    danger:
        'bg-red-500 text-white shadow-sm hover:bg-red-600 active:bg-red-700 focus-visible:ring-red-400',
    outline:
        'border border-[#155DFC] text-[#155DFC] hover:bg-[#EAF2FF] focus-visible:ring-[#155DFC]',
};

const SIZE: Record<Size, string> = {
    sm:  'text-xs px-3 py-1.5 min-h-[32px]',
    md:  'text-sm px-4 py-2   min-h-[36px]',
    lg:  'text-sm px-5 py-2.5 min-h-[42px]',
};

export default function Button({
    variant   = 'primary',
    size      = 'md',
    isLoading = false,
    leftIcon,
    rightIcon,
    children,
    className = '',
    disabled,
    ...props
}: ButtonProps) {
    return (
        <button
            className={`${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className}`}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <Loader2 size={14} className="animate-spin shrink-0" />
            ) : leftIcon ? (
                <span className="shrink-0">{leftIcon}</span>
            ) : null}
            {children}
            {!isLoading && rightIcon && (
                <span className="shrink-0">{rightIcon}</span>
            )}
        </button>
    );
}
