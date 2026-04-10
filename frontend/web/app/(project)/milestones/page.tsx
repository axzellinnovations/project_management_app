'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Flag, Loader2, Plus } from 'lucide-react';
import { getMilestones, createMilestone, updateMilestone, deleteMilestone } from '@/services/milestone-service';
import type { MilestoneResponse } from '@/types';
import { type MilestoneStatus } from './components/milestoneConfig';
import MilestoneCard from './components/MilestoneCard';
import MilestoneForm from './components/MilestoneForm';

export default function MilestonesPage() {
  const searchParams = useSearchParams();
  const projectIdStr = searchParams.get('projectId');
  const projectId = projectIdStr ? Number(projectIdStr) : null;

  const [milestones, setMilestones] = useState<MilestoneResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<MilestoneResponse | null>(null);

  const cacheKey = projectId ? `planora:milestones:${projectId}` : null;

  const loadMilestones = useCallback(async () => {
    if (!projectId || !cacheKey) return;
    // Serve from cache immediately
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        setMilestones(JSON.parse(cached) as MilestoneResponse[]);
        setLoading(false);
      } catch { /* ignore corrupt cache */ }
    }
    // Always revalidate in the background
    try {
      const data = await getMilestones(projectId);
      setMilestones(data);
      localStorage.setItem(cacheKey, JSON.stringify(data));
      setError(null);
    } catch {
      if (!cached) setError('Failed to load milestones');
    } finally {
      setLoading(false);
    }
  }, [projectId, cacheKey]);

  useEffect(() => { void loadMilestones(); }, [loadMilestones]);

  const invalidateCache = useCallback(() => {
    if (cacheKey) localStorage.removeItem(cacheKey);
  }, [cacheKey]);

  const handleCreate = async (data: { name: string; description: string; dueDate: string; status: MilestoneStatus }) => {
    if (!projectId) return;
    try {
      const created = await createMilestone(projectId, {
        name: data.name,
        description: data.description || undefined,
        dueDate: data.dueDate || undefined,
        status: data.status,
      });
      setMilestones((prev) => {
        const next = [created, ...prev];
        if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(next));
        return next;
      });
      setShowCreate(false);
    } catch {
      setError('Failed to create milestone');
    }
  };

  const handleUpdate = async (data: { name: string; description: string; dueDate: string; status: MilestoneStatus }) => {
    if (!editing) return;
    try {
      const updated = await updateMilestone(editing.id, {
        name: data.name,
        description: data.description || undefined,
        dueDate: data.dueDate || undefined,
        status: data.status,
      });
      setMilestones((prev) => {
        const next = prev.map((m) => m.id === updated.id ? updated : m);
        if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(next));
        return next;
      });
      setEditing(null);
    } catch {
      setError('Failed to update milestone');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this milestone? Tasks will not be deleted.')) return;
    try {
      await deleteMilestone(id);
      setMilestones((prev) => {
        const next = prev.filter((m) => m.id !== id);
        if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(next));
        return next;
      });
    } catch {
      setError('Failed to delete milestone');
    }
  };

  const handleStatusChange = async (id: number, status: MilestoneStatus) => {
    const m = milestones.find((x) => x.id === id);
    if (!m) return;
    setMilestones((prev) => {
      const next = prev.map((x) => x.id === id ? { ...x, status } : x);
      if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(next));
      return next;
    });
    try {
      await updateMilestone(id, { name: m.name, status });
    } catch {
      invalidateCache();
      void loadMilestones();
    }
  };

  if (!projectId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800">Missing Project ID</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-gray-50 overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Flag size={18} className="text-purple-500" /> Milestones
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Track major goals and checkpoints for this project</p>
          </div>
          <button
            onClick={() => { setShowCreate(true); setEditing(null); }}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-colors"
          >
            <Plus size={14} /> New Milestone
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle size={15} /> {error}
          </div>
        )}

        {/* Create form */}
        {showCreate && (
          <div className="mb-4">
            <MilestoneForm onSubmit={handleCreate} onCancel={() => setShowCreate(false)} />
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
        ) : milestones.length === 0 && !showCreate ? (
          <div className="text-center py-20">
            <Flag size={36} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No milestones yet</p>
            <p className="text-sm text-gray-400 mt-1">Create one to track major goals</p>
          </div>
        ) : (
          <div className="space-y-3">
            {milestones.map((m) =>
              editing?.id === m.id ? (
                <MilestoneForm
                  key={m.id}
                  initial={m}
                  onSubmit={handleUpdate}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <MilestoneCard
                  key={m.id}
                  milestone={m}
                  onEdit={setEditing}
                  onDelete={handleDelete}
                  onStatusChange={handleStatusChange}
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
