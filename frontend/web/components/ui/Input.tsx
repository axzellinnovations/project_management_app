'use client';

import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', icon, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-3 text-cu-text-tertiary pointer-events-none">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={[
              'w-full h-9 rounded-cu-md border bg-cu-bg text-cu-text-primary text-base',
              'placeholder:text-cu-text-tertiary',
              'focus:outline-none focus:ring-2 focus:ring-cu-purple focus:border-transparent',
              'transition-colors duration-fast',
              error ? 'border-cu-danger' : 'border-cu-border',
              icon ? 'pl-9 pr-3' : 'px-3',
              className,
            ].join(' ')}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1 text-xs text-cu-danger">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
