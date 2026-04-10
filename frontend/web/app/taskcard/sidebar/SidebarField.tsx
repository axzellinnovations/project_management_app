'use client';
import React from 'react';

const SidebarField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-[10px] font-bold text-[#6A7282] uppercase tracking-wider">{label}</span>
    {children}
  </div>
);

export default SidebarField;
