import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface InputFieldProps {
  label: string;
  type: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  required?: boolean;
  id?: string;
  'aria-describedby'?: string;
  showToggle?: boolean;
  autoComplete?: string;
  autoCapitalize?: string;
  autoCorrect?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}

export default function InputField({ 
  label, 
  type, 
  value, 
  onChange, 
  placeholder, 
  required = false,
  id,
  'aria-describedby': ariaDescribedby,
  showToggle = false,
  autoComplete,
  autoCapitalize,
  autoCorrect,
  inputMode,
}: InputFieldProps) {
  const [visible, setVisible] = useState(false);
  const resolvedType = showToggle && type === 'password' ? (visible ? 'text' : 'password') : type;

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={resolvedType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          aria-describedby={ariaDescribedby}
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          inputMode={inputMode}
          className={`w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-[16px] sm:text-sm${showToggle ? ' pr-11' : ''}`}
        />
        {showToggle && type === 'password' && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            tabIndex={-1}
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
    </div>
  );
}