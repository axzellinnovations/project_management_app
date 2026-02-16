import React from 'react';

export default function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[420px] bg-white rounded-[24px] shadow-sm p-8">
      {children}
    </div>
  );
}