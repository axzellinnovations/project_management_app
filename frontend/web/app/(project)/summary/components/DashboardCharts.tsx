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
    <div ref={hostRef} className="h-[250px] w-full">
      {ready ? children : null}
    </div>
  );
}

export default function DashboardCharts({ tasks = [], sprints = [] }: { tasks?: Task[], sprints?: Sprint[] }) {
  
  // 1. Task Distribution (Pie Chart) by Priority
  const taskDistribution = React.useMemo(() => {
    const dist: Record<string, number> = { URGENT: 0, HIGH: 0, MEDIUM: 0, NORMAL: 0, LOW: 0, UNASSIGNED: 0};
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

  // 2. Velocity Chart (Bar Chart) by Sprints
  const velocityData = React.useMemo(() => {
    // Sort sprints by end date or id roughly ensuring chronological order
    const completedSprints = [...sprints]
      .filter(s => s.status === 'COMPLETED')
      .slice(-4); // Last 4 sprints
    
    return completedSprints.map(sprint => {
      // Find tasks completed in this sprint (relying on sprintId mapping)
      const sprintTasks = tasks.filter(t => t.sprintId === sprint.id && t.status === 'DONE');
      const points = sprintTasks.reduce((acc, t) => acc + (t.storyPoint || 0), 0);
      return {
         name: sprint.name || `Sprint ${sprint.id}`,
         points
      };
    });
  }, [tasks, sprints]);

  // 3. Lead Time (Line Chart) over last 30 days
  const leadTimeData = React.useMemo(() => {
      // Group completed tasks by completion date in the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const doneTasks = tasks.filter(t => t.status === 'DONE' && t.completedAt && new Date(t.completedAt) >= thirtyDaysAgo);
      const daysMap: Record<string, { totalTime: number, count: number }> = {};
      
      doneTasks.forEach(t => {
          if (!t.completedAt || !t.createdAt) return;
          const date = new Date(t.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const timeToComplete = (new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime()) / (1000 * 3600 * 24); // in days
          
          if (!daysMap[date]) daysMap[date] = { totalTime: 0, count: 0 };
          daysMap[date].totalTime += timeToComplete;
          daysMap[date].count += 1;
      });

      // Sort chronological and map
      return Object.entries(daysMap).sort((a,b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()).map(([date, data]) => ({
          date,
          avgDays: Math.round((data.totalTime / data.count) * 10) / 10
      }));
  }, [tasks]);

  // 4. Burndown Chart (Line Chart) for active sprint
  const burndownData = React.useMemo(() => {
     const activeSprint = sprints.find(s => s.status === 'ACTIVE');
     if (!activeSprint || !activeSprint.startDate || !activeSprint.endDate) return [];

     const start = new Date(activeSprint.startDate);
     const end = new Date(activeSprint.endDate);
     
     // Total points in this sprint
     const sprintTasks = tasks.filter(t => t.sprintId === activeSprint.id);
     const totalPoints = sprintTasks.reduce((acc, t) => acc + (t.storyPoint || 0), 0);
     
     // Build days array
     const data = [];
     const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
     const dailyIdealDrop = totalPoints / (totalDays - 1 || 1);

     let currentRemaining = totalPoints;

     for (let i = 0; i < totalDays; i++) {
        const currentDate = new Date(start);
        currentDate.setDate(start.getDate() + i);
        const dateString = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        const ideal = Math.max(0, totalPoints - (dailyIdealDrop * i));
        
        // Find tasks completed EXACTLY on this date
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
      
      {/* Burndown Chart Element */}
      <MotionWrapper className="bg-white rounded-xl border border-[#E3E8EF] p-5 shadow-sm hover:shadow-md transition-all duration-200">
          <h3 className="font-arimo text-[16px] font-semibold text-[#101828] mb-4">Sprint Burndown</h3>
          {burndownData.length > 0 ? (
              <SafeChartFrame>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <LineChart data={burndownData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={{fontSize: 12, fill: '#6A7282'}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fontSize: 12, fill: '#6A7282'}} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E3E8EF', fontSize: '13px' }} />
                        <Legend wrapperStyle={{ fontSize: '12px' }}/>
                        <Line type="monotone" dataKey="ideal" name="Ideal Tasks" stroke="#98A2B3" strokeDasharray="5 5" dot={false} strokeWidth={2}/>
                        <Line type="stepAfter" dataKey="remaining" name="Actual Remaining" stroke="#0052CC" strokeWidth={3} activeDot={{ r: 6 }}/>
                    </LineChart>
                </ResponsiveContainer>
              </SafeChartFrame>
          ) : (
              <div className="h-[250px] flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                  <p className="text-sm text-gray-400 font-arimo">No active sprint data available</p>
              </div>
          )}
      </MotionWrapper>

      {/* Task Distribution Element */}
      <MotionWrapper className="bg-white rounded-xl border border-[#E3E8EF] p-5 shadow-sm hover:shadow-md transition-all duration-200">
          <h3 className="font-arimo text-[16px] font-semibold text-[#101828] mb-4">Task Priority Distribution</h3>
          {taskDistribution.length > 0 ? (
              <SafeChartFrame>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <PieChart>
                        <Pie
                            data={taskDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="value"
                        >
                            {taskDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={PRIORITY_COLORS[entry.name as keyof typeof PRIORITY_COLORS] || '#98A2B3'} />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E3E8EF', fontSize: '13px' }} />
                        <Legend wrapperStyle={{ fontSize: '12px' }}/>
                    </PieChart>
                </ResponsiveContainer>
              </SafeChartFrame>
          ) : (
              <div className="h-[250px] flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                  <p className="text-sm text-gray-400 font-arimo">No tasks to distribute</p>
              </div>
          )}
      </MotionWrapper>

      {/* Velocity Chart Element */}
      <MotionWrapper className="bg-white rounded-xl border border-[#E3E8EF] p-5 shadow-sm hover:shadow-md transition-all duration-200">
          <h3 className="font-arimo text-[16px] font-semibold text-[#101828] mb-4">Velocity (Completed Story Points)</h3>
          {velocityData.length > 0 ? (
              <SafeChartFrame>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart data={velocityData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{fontSize: 12, fill: '#6A7282'}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fontSize: 12, fill: '#6A7282'}} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E3E8EF', fontSize: '13px' }} cursor={{fill: '#F2F4F7'}} />
                        <Bar dataKey="points" fill="#00875A" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    </BarChart>
                </ResponsiveContainer>
              </SafeChartFrame>
          ) : (
              <div className="h-[250px] flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                  <p className="text-sm text-gray-400 font-arimo">Complete sprints to unlock velocity tracking</p>
              </div>
          )}
      </MotionWrapper>

      {/* Lead Time Chart Element */}
      <MotionWrapper className="bg-white rounded-xl border border-[#E3E8EF] p-5 shadow-sm hover:shadow-md transition-all duration-200">
          <h3 className="font-arimo text-[16px] font-semibold text-[#101828] mb-4">Lead Time (Average Days to Complete)</h3>
          {leadTimeData.length > 0 ? (
              <SafeChartFrame>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <LineChart data={leadTimeData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={{fontSize: 12, fill: '#6A7282'}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fontSize: 12, fill: '#6A7282'}} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E3E8EF', fontSize: '13px' }} />
                        <Line type="monotone" dataKey="avgDays" name="Avg Days" stroke="#FF8B00" strokeWidth={3} dot={{r: 4}} activeDot={{ r: 6 }}/>
                    </LineChart>
                </ResponsiveContainer>
              </SafeChartFrame>
          ) : (
              <div className="h-[250px] flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                  <p className="text-sm text-gray-400 font-arimo">Not enough completed tasks for data</p>
              </div>
          )}
      </MotionWrapper>

    </div>
  );
}
