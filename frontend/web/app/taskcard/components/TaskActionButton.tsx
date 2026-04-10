'use client';
import React from 'react';

interface TaskActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

const TaskActionButton: React.FC<TaskActionButtonProps> = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E5E7EB] hover:bg-[#F0F5FF] hover:border-[#155DFC] rounded-lg text-[12px] font-medium text-[#374151] hover:text-[#155DFC] transition-all shadow-sm"
  >
    {icon} {label}
  </button>
);

export default TaskActionButton;
