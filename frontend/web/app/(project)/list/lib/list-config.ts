import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import React from 'react';

export const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  TODO:        { label: 'To Do',       badge: 'bg-gray-100 text-gray-600' },
  IN_PROGRESS: { label: 'In Progress', badge: 'bg-blue-50 text-blue-700' },
  IN_REVIEW:   { label: 'In Review',   badge: 'bg-amber-50 text-amber-700' },
  DONE:        { label: 'Done',        badge: 'bg-green-50 text-green-700' },
};

export const STATUS_ORDER = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

export const PRIORITY_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  URGENT: { color: '#EF4444', icon: ArrowUp,    label: 'Urgent' },
  HIGH:   { color: '#F97316', icon: ArrowUp,    label: 'High'   },
  MEDIUM: { color: '#F59E0B', icon: ArrowRight, label: 'Medium' },
  LOW:    { color: '#22C55E', icon: ArrowDown,  label: 'Low'    },
};
