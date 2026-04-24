"use client";
import React, { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { TaskActivity } from '@/types';

interface ActivityFeedProps {
  taskId?: number;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// Keyed by activityType string from the API so new event types get a default '•'
// without requiring a code change, and existing ones get a recognisable icon.
const ACTIVITY_ICONS: Record<string, string> = {
  TASK_CREATED:     '✨',
  STATUS_CHANGED:   '🔄',
  PRIORITY_CHANGED: '🔥',
  ASSIGNEE_CHANGED: '👤',
  SUBTASK_ADDED:    '➕',
  SUBTASK_COMPLETED:'✅',
  COMMENT_ADDED:    '💬',
  ATTACHMENT_ADDED: '📎',
  ATTACHMENT_DELETED:'🗑️',
  LABEL_ADDED:      '🏷️',
  LABEL_REMOVED:    '🏷️',
};

const ACTIVITY_COLORS: Record<string, string> = {
  TASK_CREATED:     'bg-blue-100 border-blue-300',
  STATUS_CHANGED:   'bg-purple-100 border-purple-300',
  PRIORITY_CHANGED: 'bg-orange-100 border-orange-300',
  ASSIGNEE_CHANGED: 'bg-teal-100 border-teal-300',
  SUBTASK_ADDED:    'bg-green-100 border-green-300',
  SUBTASK_COMPLETED:'bg-green-100 border-green-300',
  COMMENT_ADDED:    'bg-blue-50 border-blue-200',
  ATTACHMENT_ADDED: 'bg-yellow-100 border-yellow-300',
  ATTACHMENT_DELETED:'bg-red-100 border-red-300',
  LABEL_ADDED:      'bg-pink-100 border-pink-300',
  LABEL_REMOVED:    'bg-pink-100 border-pink-300',
};

const ActivityFeed: React.FC<ActivityFeedProps> = ({ taskId }) => {
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    const load = () => {
      setLoading(true);
      api.get<TaskActivity[]>(`/api/tasks/${taskId}/activities`)
        .then((res) => setActivities(res.data))
        .catch(() => setActivities([]))
        .finally(() => setLoading(false));
    };
    load();
  }, [taskId]);

  if (loading) {
    return (
      <div className="mt-4 text-center py-8 text-gray-400 text-sm">Loading activity...</div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="mt-4 text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-200">
        <p className="text-gray-500 text-sm font-medium mb-1">No activity yet</p>
        <p className="text-gray-400 text-xs">Changes to this task will appear here.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 relative pl-5 border-l-2 border-gray-100 space-y-5">
      {activities.map((activity) => {
        const icon = ACTIVITY_ICONS[activity.activityType] ?? '•';
        const colorClass = ACTIVITY_COLORS[activity.activityType] ?? 'bg-gray-100 border-gray-300';
        return (
          <div key={activity.id} className="relative">
            {/* Timeline dot */}
            <div className={`absolute -left-[23px] w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] ${colorClass}`}>
              {icon}
            </div>
            <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
              <span className="text-sm font-semibold text-gray-800">{activity.actorName}</span>
              <span className="text-xs text-gray-400">{timeAgo(activity.createdAt)}</span>
            </div>
            <p className="text-sm text-gray-600 bg-gray-50 rounded px-3 py-1.5 border border-gray-100">
              {activity.description}
            </p>
          </div>
        );
      })}
    </div>
  );
};

export default ActivityFeed;
