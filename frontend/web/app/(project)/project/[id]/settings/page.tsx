'use client';
import React from 'react';
import { useParams } from 'next/navigation';
import CustomFieldsManager from './CustomFieldsManager';

export default function ProjectSettingsPage() {
  const params = useParams();
  const projectId = Number(params.id);

  if (isNaN(projectId)) {
    return <div className="p-8 text-red-500">Invalid project ID.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Project Settings</h1>
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <CustomFieldsManager projectId={projectId} />
      </div>
    </div>
  );
}
