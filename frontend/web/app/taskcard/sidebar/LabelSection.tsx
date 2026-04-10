'use client';
import React from 'react';
import SidebarField from './SidebarField';

interface LabelSectionProps {
  labels: string[];
}

const LabelSection: React.FC<LabelSectionProps> = ({ labels }) => {
  if (!labels || labels.length === 0) return null;

  return (
    <SidebarField label="Labels">
      <div className="flex flex-wrap gap-2">
        {labels.map((label) => (
          <span
            key={label}
            className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200 cursor-pointer transition-colors"
          >
            {label}
          </span>
        ))}
        <button className="text-xs text-gray-400 hover:text-gray-600 transition-colors">+ Add</button>
      </div>
    </SidebarField>
  );
};

export default LabelSection;
