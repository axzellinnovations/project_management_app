'use client';
import React from 'react';

interface ProgressRingProps {
  value: number;
  max: number;
}

const ProgressRing: React.FC<ProgressRingProps> = ({ value, max }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const size = 40;
  const r = 15;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <svg width={size} height={size} className="flex-shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#e5e7eb" strokeWidth="3" fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        stroke="#3b82f6" strokeWidth="3" fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-500"
      />
    </svg>
  );
};

export default ProgressRing;
