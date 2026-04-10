'use client';
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { getOrFetchUserMap } from './userMapCache';
import SidebarField from './SidebarField';

interface ReporterSectionProps {
  reporter: string | null;
}

const ReporterSection: React.FC<ReporterSectionProps> = ({ reporter }) => {
  const [usersMap, setUsersMap] = useState<Record<string, string | null>>({});

  useEffect(() => {
    void getOrFetchUserMap().then(setUsersMap);
  }, []);

  if (!reporter) return null;

  const picUrl = usersMap[reporter] ?? '';

  return (
    <SidebarField label="Reporter">
      <div className="flex items-center gap-2 hover:bg-gray-50 p-1 -ml-1 rounded cursor-pointer group">
        <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold overflow-hidden">
          {picUrl ? (
            <Image src={picUrl} alt={reporter} width={24} height={24} className="w-full h-full object-cover" unoptimized />
          ) : (
            reporter.charAt(0).toUpperCase()
          )}
        </div>
        <span className="text-sm text-blue-600 group-hover:underline">{reporter}</span>
      </div>
    </SidebarField>
  );
};

export default ReporterSection;
