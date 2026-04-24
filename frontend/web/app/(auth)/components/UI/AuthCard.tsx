import React from 'react';

/*
 * A reusable layout wrapper for all authentication screens (Login, Register, OTP).
 * Centralizing the "card" design ensures that if we ever want to change 
 * the padding, border radius, we only have to do it in one file 
 * rather than hunting down every auth page.
 */
export default function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    // 'glass-panel' implies a custom utility class defined in your global CSS.
    // The max-w-[420px] keeps the form readable on ultra-wide monitors.
    <div className="w-full max-w-[420px] glass-panel rounded-[24px] p-4 sm:p-8 shadow-xl">
      {children}
    </div>
  );
}