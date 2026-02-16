import React from 'react';

interface InputFieldProps {
  label: string;
  type: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  required?: boolean;
}

export default function InputField({ 
  label, 
  type, 
  value, 
  onChange, 
  placeholder, 
  required = false 
}: InputFieldProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
      />
    </div>
  );
}