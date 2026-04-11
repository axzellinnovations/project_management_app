'use client';

import { useEffect, useMemo, useState } from 'react';

export const RADIUS = 64;
export const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export const DONUT_STATUSES = [
    { key: 'TODO', label: 'To Do', color: '#D1D5DB' },
    { key: 'IN_PROGRESS', label: 'In Progress', color: '#3B82F6' },
    { key: 'IN_REVIEW', label: 'In Review', color: '#F59E0B' },
] as const;

export function useDonutChart(items: { status?: string | null }[]) {
    const data = useMemo(() => {
        const counts = DONUT_STATUSES.map((s) => ({
            ...s,
            count: (items || []).filter((i) => i.status === s.key).length,
        }));
        const total = counts.reduce((acc, curr) => acc + curr.count, 0);
        const slicesWithOrigin = counts.map((slice, index, arr) => {
            const proportion = total > 0 ? slice.count / total : 0;
            const currentOrigin = arr
                .slice(0, index)
                .reduce((sum, s) => sum + (total > 0 ? s.count / total : 0), 0);
            return { ...slice, proportion, currentOrigin, dashLength: proportion * CIRCUMFERENCE };
        });
        return { counts, total, slicesWithOrigin };
    }, [items]);

    const [displayCount, setDisplayCount] = useState(0);

    useEffect(() => {
        if (data.total === 0) {
            const t = setTimeout(() => setDisplayCount(0), 0);
            return () => clearTimeout(t);
        }
        const end = data.total;
        const duration = 600;
        const startTime = performance.now();
        const update = (now: number) => {
            const progress = Math.min((now - startTime) / duration, 1);
            const easeOut = 1 - (1 - progress) * (1 - progress);
            setDisplayCount(Math.round(end * easeOut));
            if (progress < 1) requestAnimationFrame(update);
        };
        const timer = setTimeout(() => requestAnimationFrame(update), 600);
        return () => clearTimeout(timer);
    }, [data.total]);

    return { data, displayCount };
}
