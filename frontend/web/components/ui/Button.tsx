'use client';

import React from 'react';

// Inline cva since class-variance-authority isn't installed yet — use plain function
// Re-implemented without cva dep to avoid extra install

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'link';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';
  loading?: boolean;
}

const variantClasses: Record<string, string> = {
  primary: 'bg-cu-purple text-white hover:bg-cu-purple-hover active:bg-[#5B4BCF] shadow-cu-sm',
  secondary: 'bg-cu-bg-secondary text-cu-text-primary border border-cu-border hover:bg-cu-bg-tertiary',
  ghost: 'text-cu-text-secondary hover:bg-cu-bg-secondary hover:text-cu-text-primary',
  danger: 'bg-cu-danger text-white hover:bg-[#E54545] active:bg-[#CC3D3D]',
  outline: 'border border-cu-border text-cu-text-primary hover:bg-cu-bg-secondary',
  link: 'text-cu-purple hover:text-cu-purple-hover underline-offset-4 hover:underline p-0 h-auto',
};

const sizeClasses: Record<string, string> = {
  xs: 'h-7 px-2 text-xs',
  sm: 'h-8 px-3 text-sm',
  md: 'h-9 px-4 text-base',
  lg: 'h-10 px-5 text-md',
  icon: 'h-8 w-8 p-0',
  'icon-sm': 'h-7 w-7 p-0',
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    const classes = [
      'inline-flex items-center justify-center gap-2 font-medium transition-colors duration-200 rounded-cu-md',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cu-purple focus-visible:ring-offset-1',
      'disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap',
      variantClasses[variant],
      sizeClasses[size],
      className,
    ].join(' ');

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button };
