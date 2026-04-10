'use client';
import React from 'react';

const SidebarField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <span className="text-xs text-gray-500 font-medium">{label}</span>
    {children}
  </div>
);

export default SidebarField;
