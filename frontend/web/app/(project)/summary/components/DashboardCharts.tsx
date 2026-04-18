'use client';

import React from 'react';
import { Task, Sprint } from '@/types';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import MotionWrapper from './MotionWrapper';

const PRIORITY_COLORS = {
  URGENT: '#DE350B', // Red
  HIGH: '#FF8B00',   // Orange
  MEDIUM: '#FFC400', // Yellow
  NORMAL: '#0052CC', // Blue
  LOW: '#00875A',    // Green
};

function SafeChartFrame({ children }: { children: React.ReactNode }) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const element = hostRef.current;
    if (!element) return;

    const evaluateSize = () => {
      const rect = element.getBoundingClientRect();
      setReady(rect.width > 0 && rect.height > 0);
    };

    evaluateSize();
    const observer = new ResizeObserver(evaluateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="h-full min-h-[220px] w-full">
      {ready ? children : null}
    </div>
  );
}

export function BurndownChartWidget({ tasks, sprints }: { tasks: Task[], sprints: Sprint[] }) {
  const burndownData = React.useMemo(() => {
    const activeSprint = sprints.find(s => s.status === 'ACTIVE');
    if (!activeSprint || !activeSprint.startDate || !activeSprint.endDate) return [];

    const start = new Date(activeSprint.startDate);
    const end = new Date(activeSprint.endDate);

    const sprintTasks = tasks.filter(t => t.sprintId === activeSprint.id);
    const totalPoints = sprintTasks.reduce((acc, t) => acc + (t.storyPoint || 0), 0);

    const data = [];
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
    const dailyIdealDrop = totalPoints / (totalDays - 1 || 1);

    let currentRemaining = totalPoints;

    for (let i = 0; i < totalDays; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + i);
      const dateString = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const ideal = Math.max(0, totalPoints - (dailyIdealDrop * i));

      const completedToday = sprintTasks.filter(t => {
        if (t.status !== 'DONE' || !t.completedAt) return false;
        const cDate = new Date(t.completedAt);
        return cDate.toDateString() === currentDate.toDateString();
      });

      const pointsDoneToday = completedToday.reduce((acc, t) => acc + (t.storyPoint || 0), 0);

      if (currentDate <= new Date()) {
        currentRemaining -= pointsDoneToday;
        data.push({ date: dateString, ideal: Math.round(ideal), remaining: Math.max(0, currentRemaining) });
      } else {
        data.push({ date: dateString, ideal: Math.round(ideal), remaining: null });
      }
    }
    return data;
  }, [tasks, sprints]);

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-1 min-h-0 w-full relative">
        {burndownData.length > 0 ? (
          <SafeChartFrame>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={burndownData} margin={{ top: 4, right: 8, bottom: 0, left: -28 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#6A7282' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: '#6A7282' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E3E8EF', fontSize: '11px' }} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Line type="monotone" dataKey="ideal" name="Ideal" stroke="#98A2B3" strokeDasharray="5 5" dot={false} strokeWidth={1.5} />
                <Line type="stepAfter" dataKey="remaining" name="Actual" stroke="#0052CC" strokeWidth={2} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </SafeChartFrame>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <p className="text-[11px] text-gray-400 font-arimo">No active sprint data</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function TaskDistributionWidget({ tasks }: { tasks: Task[] }) {
  const taskDistribution = React.useMemo(() => {
    const dist: Record<string, number> = { URGENT: 0, HIGH: 0, MEDIUM: 0, NORMAL: 0, LOW: 0, UNASSIGNED: 0 };
    tasks.forEach(t => {
      const p = t.priority?.toUpperCase();
      if (p && dist[p] !== undefined) {
        dist[p]++;
      } else {
        dist['UNASSIGNED']++;
      }
    });
    return Object.entries(dist)
      .filter(([_, count]) => count > 0)
      .map(([name, value]) => ({ name, value }));
  }, [tasks]);

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-1 min-h-0 w-full relative">
        {taskDistribution.length > 0 ? (
          <div className="absolute inset-0">
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10" style={{ transform: 'translateY(-12px)' }}>
               <h3 className="text-[18px] font-black text-[#101828] leading-none mb-0.5">{tasks.length}</h3>
               <p className="text-[9px] font-bold text-[#667085] uppercase tracking-widest">Tasks</p>
            </div>
            <SafeChartFrame>
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={taskDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius="40%"
                    outerRadius="68%"
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {taskDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PRIORITY_COLORS[entry.name as keyof typeof PRIORITY_COLORS] || '#98A2B3'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E3E8EF', fontSize: '11px' }} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} height={16} />
                </PieChart>
              </ResponsiveContainer>
            </SafeChartFrame>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <p className="text-[11px] text-gray-400 font-arimo">No tasks to distribute</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function VelocityChartWidget({ tasks, sprints }: { tasks: Task[], sprints: Sprint[] }) {
  const velocityData = React.useMemo(() => {
    const completedSprints = [...sprints]
      .filter(s => s.status === 'COMPLETED')
      .slice(-4); 

    return completedSprints.map(sprint => {
      const sprintTasks = tasks.filter(t => t.sprintId === sprint.id && t.status === 'DONE');
      const points = sprintTasks.reduce((acc, t) => acc + (t.storyPoint || 0), 0);
      return {
        name: sprint.name || `Sprint ${sprint.id}`,
        points
      };
    });
  }, [tasks, sprints]);

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-1 min-h-0 w-full relative">
        {velocityData.length > 0 ? (
          <SafeChartFrame>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={velocityData} margin={{ top: 4, right: 8, bottom: 0, left: -28 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#6A7282' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#6A7282' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E3E8EF', fontSize: '11px' }} cursor={{ fill: '#F2F4F7' }} />
                <Bar dataKey="points" fill="#00875A" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </SafeChartFrame>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <p className="text-[11px] text-gray-400 font-arimo">Complete sprints to show velocity</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function LeadTimeChartWidget({ tasks }: { tasks: Task[] }) {
  const leadTimeData = React.useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const doneTasks = tasks.filter(t => t.status === 'DONE' && t.completedAt && new Date(t.completedAt) >= thirtyDaysAgo);
    const daysMap: Record<string, { totalTime: number, count: number }> = {};

    doneTasks.forEach(t => {
      if (!t.completedAt || !t.createdAt) return;
      const date = new Date(t.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const timeToComplete = (new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime()) / (1000 * 3600 * 24);

      if (!daysMap[date]) daysMap[date] = { totalTime: 0, count: 0 };
      daysMap[date].totalTime += timeToComplete;
      daysMap[date].count += 1;
    });

    return Object.entries(daysMap).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()).map(([date, data]) => ({
      date,
      avgDays: Math.round((data.totalTime / data.count) * 10) / 10
    }));
  }, [tasks]);

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-1 min-h-0 w-full relative">
        {leadTimeData.length > 0 ? (
          <SafeChartFrame>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={leadTimeData} margin={{ top: 4, right: 8, bottom: 0, left: -28 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#6A7282' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: '#6A7282' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E3E8EF', fontSize: '11px' }} />
                <Line type="monotone" dataKey="avgDays" name="Avg Days" stroke="#FF8B00" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </SafeChartFrame>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <p className="text-[11px] text-gray-400 font-arimo">Not enough data</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Keep a default export for fallback if ever needed, or just remove it to force named imports
export default function DashboardCharts() {
  return null;
}
