'use client';
import React from 'react';

interface KbdKeyProps {
  children: React.ReactNode;
  className?: string;
}

const KbdKey: React.FC<KbdKeyProps> = ({ children, className = '' }) => (
  <kbd
    className={`inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 border border-gray-300 rounded shadow-sm font-mono ${className}`}
  >
    {children}
  </kbd>
);

export default KbdKey;
