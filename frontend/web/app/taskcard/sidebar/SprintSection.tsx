'use client';
import React from 'react';
import SidebarField from './SidebarField';

interface SprintSectionProps {
  sprint: string | null;
}

const SprintSection: React.FC<SprintSectionProps> = ({ sprint }) => {
  if (!sprint) return null;

  return (
    <SidebarField label="Sprint">
      <span className="text-sm text-blue-600 hover:underline cursor-pointer">{sprint}</span>
    </SidebarField>
  );
};

export default SprintSection;
