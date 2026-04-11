import React from 'react';

export default function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[420px] glass-panel rounded-[24px] p-4 sm:p-8 shadow-xl">
      {children}
    </div>
  );
}