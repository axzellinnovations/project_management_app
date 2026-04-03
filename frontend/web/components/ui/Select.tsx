'use client';

import React from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  error?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', options, placeholder, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <select
          ref={ref}
          className={[
            'w-full h-9 rounded-cu-md border bg-cu-bg text-cu-text-primary text-base px-3',
            'focus:outline-none focus:ring-2 focus:ring-cu-purple focus:border-transparent',
            'transition-colors duration-fast appearance-none cursor-pointer',
            'bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E")]',
            'bg-[position:right_0.75rem_center] bg-no-repeat pr-8',
            error ? 'border-cu-danger' : 'border-cu-border',
            className,
          ].join(' ')}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-xs text-cu-danger">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';

export { Select };
