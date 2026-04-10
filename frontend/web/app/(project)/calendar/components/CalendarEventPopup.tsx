'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { CalendarEventItem } from '../types';

interface CalendarEventPopupProps {
    event: CalendarEventItem;
    position: { x: number; y: number };
    onClose: () => void;
}

const STATUS_COLORS: Record<string, string> = {
    TODO:        'bg-gray-100 text-gray-600',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    IN_REVIEW:   'bg-yellow-100 text-yellow-800',
    DONE:        'bg-green-100 text-green-700',
    Planned:     'bg-gray-100 text-gray-600',
    Active:      'bg-blue-100 text-blue-700',
    Completed:   'bg-green-100 text-green-700',
};

function formatDate(d?: string) {
    if (!d) return null;
    try {
        return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return d;
    }
}

export default function CalendarEventPopup({ event, position, onClose }: CalendarEventPopupProps) {
    const ref = useRef<HTMLDivElement>(null);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        // Small delay so the same click that opened the popup doesn't immediately close it
        const id = setTimeout(() => document.addEventListener('mousedown', handler), 50);
        return () => { clearTimeout(id); document.removeEventListener('mousedown', handler); };
    }, [onClose]);

    // Clamp popup to viewport
    const POPUP_W = 288;
    const POPUP_H = 240;
    const left = typeof window !== 'undefined'
        ? Math.min(position.x, window.innerWidth - POPUP_W - 8)
        : position.x;
    const top = typeof window !== 'undefined'
        ? Math.min(position.y + 8, window.innerHeight - POPUP_H - 8)
        : position.y + 8;

    return (
        <div
            ref={ref}
            style={{ position: 'fixed', left, top, zIndex: 200, width: POPUP_W }}
            className="bg-white rounded-xl border border-[#E4E7EC] shadow-xl overflow-hidden"
        >
            {/* Header */}
            <div className={`px-4 py-3 flex items-start justify-between gap-2 ${event.kind === 'sprint' ? 'bg-[#DFF3FF]' : 'bg-[#F9FAFB]'}`}>
                <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#101828] truncate">{event.title}</p>
                    <span className={`inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${event.kind === 'sprint' ? 'bg-[#B2DDFF] text-[#175CD3]' : 'bg-[#E4E7EC] text-[#344054]'}`}>
                        {event.kind === 'sprint' ? 'Sprint' : (event.type ?? 'Task')}
                    </span>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 text-[#98A2B3] hover:text-[#344054] rounded transition-colors shrink-0 mt-0.5"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Body */}
            <div className="px-4 py-3 space-y-2">
                {event.status && (
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#667085] w-16 shrink-0">Status</span>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[event.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {event.status.replace(/_/g, ' ')}
                        </span>
                    </div>
                )}
                {event.assignee && (
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#667085] w-16 shrink-0">Assignee</span>
                        <span className="text-[11px] text-[#101828]">{event.assignee}</span>
                    </div>
                )}
                {(event.startDate || event.dueDate) && (
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#667085] w-16 shrink-0">
                            {event.kind === 'sprint' ? 'Start' : 'Due'}
                        </span>
                        <span className="text-[11px] text-[#101828]">{formatDate(event.startDate || event.dueDate)}</span>
                    </div>
                )}
                {event.endDate && event.kind === 'sprint' && (
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#667085] w-16 shrink-0">End</span>
                        <span className="text-[11px] text-[#101828]">{formatDate(event.endDate)}</span>
                    </div>
                )}
                {event.description && (
                    <p className="text-[12px] text-[#475467] line-clamp-3 pt-2 border-t border-[#F2F4F7] mt-1">
                        {event.description}
                    </p>
                )}
            </div>
        </div>
    );
}
