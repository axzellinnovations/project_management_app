'use client';

import React, { useMemo, useState } from 'react';
import { Task, TeamMemberInfo } from '@/types';
import { PieChart, Pie, Cell, ResponsiveContainer, Sector, PieSectorShapeProps } from 'recharts';
import MotionWrapper from './MotionWrapper';
import { Briefcase, UserPlus } from 'lucide-react';
import useSWR from 'swr';
import api from '@/lib/axios';
import Link from 'next/link';
import Image from 'next/image';

const COLORS = ['#0052CC', '#00875A', '#FF8B00', '#DE350B', '#FFC400', '#6554C0', '#36B37E', '#FF5630', '#2684FF', '#FF991F'];
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

interface UserProfileItem {
  userId: number;
  email?: string;
  username?: string;
  profilePicUrl?: string;
}

interface WorkloadEntry {
  isMember: boolean;
  id?: number;
  name: string;
  role?: string;
  avatar?: string | null;
  initials?: string;
  tasks: number;
  completed: number;
  overdue: number;
  value: number;
  color: string;
}

interface ActiveShapeProps {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  fill?: string;
}

function formatRole(role?: string) {
  if (!role) return 'Team Member';
  const mapping: Record<string, string> = {
    'OWNER': 'Project Owner',
    'ADMIN': 'Admin',
    'MEMBER': 'Team Member',
    'VIEWER': 'Viewer'
  };
  if (mapping[role.toUpperCase()]) return mapping[role.toUpperCase()];

  return role.split('_').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
}

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
    <div ref={hostRef} className="h-full min-h-[250px] w-full">
      {ready ? children : null}
    </div>
  );
}

const renderActiveShape = (props: ActiveShapeProps) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  const safeFill = fill || '#0052CC';

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={safeFill}
        className="transition-all duration-300 drop-shadow-md"
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 12}
        outerRadius={outerRadius + 16}
        fill={safeFill}
      />
    </g>
  );
};

export function WorkloadDistribution({ projectId, tasks = [] }: { projectId: number | string; tasks: Task[] }) {
  const [activeIndex, setActiveIndex] = useState(-1);

  const renderPieShape = (shapeProps: PieSectorShapeProps) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, index } = shapeProps;
    const safeFill = fill || '#0052CC';

    if (index !== activeIndex) {
      return (
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={safeFill}
          className="transition-all duration-300"
        />
      );
    }

    return renderActiveShape({ cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill: safeFill });
  };

  const fetcher = (url: string) => api.get(url).then(res => res.data);

  // Fetch members
  const { data: members = [] } = useSWR<TeamMemberInfo[]>(
    projectId ? `/api/projects/${projectId}/members` : null,
    fetcher
  );

  // Fetch user profiles globally to resolve mis-mapped avatars
  const { data: usersData = [] } = useSWR<UserProfileItem[]>(
    members.length > 0 ? '/api/auth/users' : null,
    fetcher
  );

  const userProfiles = useMemo(() => {
    if (!usersData || usersData.length === 0) return {};
    const profilesMap: Record<string, string> = {};
    usersData.forEach((u) => {
      if (u.profilePicUrl) {
        const fullUrl = u.profilePicUrl.startsWith('http') ? u.profilePicUrl : `${API_BASE_URL}${u.profilePicUrl.startsWith('/') ? '' : '/'}${u.profilePicUrl}`;
        profilesMap[`id:${u.userId}`] = fullUrl;
        profilesMap[`email:${u.email}`] = fullUrl;
        profilesMap[`username:${u.username}`] = fullUrl;
      }
    });
    return profilesMap;
  }, [usersData]);

  const workloadData = useMemo(() => {
    const workloads: Record<string, Omit<WorkloadEntry, 'value' | 'color'>> = {};

    // 1. Initialize all actual team members first (so people with 0 tasks also show up!)
    members.forEach(m => {
      let pathName = m.user.profilePicUrl;
      if (!pathName) {
        pathName = userProfiles[`id:${m.user.userId}`] || userProfiles[`email:${m.user.username}`] || userProfiles[`username:${m.user.username}`] || null;
      } else if (!pathName.startsWith('http')) {
        pathName = `${API_BASE_URL}${pathName.startsWith('/') ? '' : '/'}${pathName}`;
      }

      workloads[`M_${m.id}`] = {
        isMember: true,
        id: m.id,
        name: m.user.fullName || m.user.username,
        role: m.role,
        avatar: pathName,
        initials: (m.user.fullName || m.user.username || 'U').substring(0, 2).toUpperCase(),
        tasks: 0,
        completed: 0,
        overdue: 0
      };
    });

    // 2. Distribute tasks
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    tasks.forEach(t => {
      let key = "UNASSIGNED";
      if (t.assigneeId && workloads[`M_${t.assigneeId}`]) {
        key = `M_${t.assigneeId}`;
      } else if (t.assigneeName) {
        // Task assigned to someone not in members array? Add them seamlessly
        key = `O_${t.assigneeName}`;
        if (!workloads[key]) {
          workloads[key] = {
            isMember: false,
            name: t.assigneeName,
            avatar: t.assigneePhotoUrl,
            initials: t.assigneeName.substring(0, 2).toUpperCase(),
            tasks: 0, completed: 0, overdue: 0
          };
        }
      } else {
        if (!workloads["UNASSIGNED"]) {
          workloads["UNASSIGNED"] = {
            isMember: false,
            name: 'Unassigned',
            tasks: 0, completed: 0, overdue: 0
          };
        }
      }

      workloads[key].tasks += 1;
      if (t.status === 'DONE' || t.status === 'COMPLETED') {
        workloads[key].completed += 1;
      } else if (t.dueDate && new Date(t.dueDate) < today) {
        workloads[key].overdue += 1;
      }
    });

    // 3. Format into array and assign colors
    return Object.values(workloads)
      .sort((a, b) => b.tasks - a.tasks || (a.isMember === b.isMember ? 0 : a.isMember ? -1 : 1)) // Sort by task count, then members first
      .map((data, index) => ({
        ...data,
        value: data.tasks,
        color: COLORS[index % COLORS.length]
      }));
  }, [members, tasks, userProfiles]);

  const activeWorkloadData = useMemo(() => workloadData.filter(d => d.value > 0), [workloadData]);

  const onPieEnter = (_payload: unknown, index: number) => {
    setActiveIndex(index);
  };

  // If no members and no tasks, just return simple prompt.
  if (workloadData.length === 0 && members.length === 0) {
    return null; // Will fallback to skeleton in index or handled differently
  }

  return (
    <MotionWrapper className="relative bg-white/60 backdrop-blur-2xl rounded-2xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 overflow-hidden">
      {/* Decorative gradient blob background for glass effect */}
      <div className="absolute top-[-50%] left-[-10%] w-[60%] h-[150%] bg-gradient-to-r from-blue-100/40 to-emerald-50/40 rounded-full blur-3xl -z-10 animate-pulse pointer-events-none" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[100%] bg-gradient-to-l from-amber-50/40 to-purple-50/40 rounded-full blur-3xl -z-10 animate-pulse pointer-events-none" style={{ animationDuration: '10s' }} />

      <div className="p-5 border-b border-white/50 flex items-center justify-between bg-white/40">
        <h2 className="font-arimo text-[16px] font-semibold text-[#101828] flex items-center gap-2">
          <Briefcase size={18} className="text-[#0052CC]" />
          Team Workload Distribution
        </h2>
      </div>

      <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-white/50">

        {/* Pie Chart Section */}
        <div className="w-full lg:w-4/12 p-6 flex flex-col items-center justify-center relative" onMouseLeave={() => setActiveIndex(-1)}>

          {activeWorkloadData.length > 0 ? (
            <div className="relative w-full h-[280px]">
              {/* Perfectly centered absolute HTML inside the precise PieChart geometry */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-all duration-300 z-10 opacity-100">
                {activeIndex === -1 ? (
                  <>
                    <h3 className="text-[24px] font-black text-[#101828] leading-none mb-1">{members.length}</h3>
                    <p className="text-[10px] font-bold text-[#667085] uppercase tracking-widest mb-1.5">Members</p>
                    <div className="w-8 h-[2px] bg-gray-200 rounded-full mb-1.5"></div>
                    <h3 className="text-[18px] font-black text-[#0052CC] leading-none mb-1">{tasks.length}</h3>
                    <p className="text-[10px] font-bold text-[#667085] uppercase tracking-widest">Tasks</p>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 mt-[-2px]">
                    <h3 className="text-[22px] font-arimo font-extrabold tracking-tight bg-gradient-to-br from-[#101828] to-[#667085] bg-clip-text text-transparent leading-[1.2] text-center px-4 line-clamp-1">
                      {activeWorkloadData[activeIndex]?.name === 'Unassigned' ? 'Unassigned' : activeWorkloadData[activeIndex]?.name?.split(' ')[0] || 'Unknown'}
                    </h3>
                    <p className="text-[13px] font-arimo text-[#667085]">
                      {activeWorkloadData[activeIndex]?.value || 0} Tasks ({Math.round(((activeWorkloadData[activeIndex]?.value || 0) / (tasks.length || 1)) * 100)}%)
                    </p>
                  </div>
                )}
              </div>

              <SafeChartFrame>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart onMouseLeave={() => setActiveIndex(-1)}>
                    <Pie
                      shape={renderPieShape}
                      data={activeWorkloadData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={95}
                      dataKey="value"
                      onMouseEnter={onPieEnter}
                    >
                      {activeWorkloadData.map((entry: { color: string }, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} style={{ outline: 'none' }} />
                      ))}
                    </Pie>
                  </PieChart>

                </ResponsiveContainer>
              </SafeChartFrame>
            </div>
          ) : (
            <div className="h-[280px] w-full flex flex-col items-center justify-center text-gray-400">
              <Briefcase size={32} className="mb-2 opacity-30 text-gray-400" />
              <p className="font-arimo text-[13px]">No tasks assigned yet</p>
            </div>
          )}

          <Link
            href={`/members/${projectId}?invite=true`}
            className="group absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-[#344054] bg-white/80 backdrop-blur-md border border-white/80 hover:bg-[#0052CC] hover:text-white hover:border-[#0052CC] rounded-xl px-4 py-2 font-arimo text-[12px] font-bold transition-all duration-300 shadow-sm hover:shadow-lg active:scale-[0.97] z-20"
          >
            <UserPlus size={14} /> Add Member
          </Link>
        </div>

        {/* Members Workload Grid Section (Modern Unified ProjectTeam design) */}
        <div className="w-full lg:w-8/12 p-6 relative" onMouseLeave={() => setActiveIndex(-1)}>

          <div className="grid grid-cols-1 gap-3 max-h-[310px] overflow-y-auto pr-3 custom-scrollbar relative z-10 w-full pb-8">
            {workloadData.map((member) => {
              const actualPieIndex = activeWorkloadData.findIndex(d => d.name === member.name);

              return (
                <div
                  key={member.name}
                  onMouseEnter={() => setActiveIndex(actualPieIndex)}
                  onClick={() => setActiveIndex(actualPieIndex)}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-white/60 backdrop-blur-md transition-all cursor-pointer ${actualPieIndex === activeIndex && actualPieIndex !== -1 ? 'border-white/90 shadow-md ring-1 ring-white shadow-[0_4px_20px_rgb(0,82,204,0.06)] scale-[1.01]' : 'border-white/50 hover:border-white/80 hover:bg-white/80'
                    }`}
                >
                  {/* Member Profile Block */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center shadow-sm text-white font-arimo text-[13px] font-bold ring-2 ring-white/80 backdrop-blur-sm"
                      style={{ backgroundColor: member.color }}
                    >
                      {member.avatar ? (
                        <Image src={member.avatar} alt={member.name} width={40} height={40} className="w-10 h-10 rounded-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      ) : (
                        <span>{member.initials || 'U'}</span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-arimo text-[14px] font-bold text-[#101828] leading-none mb-1.5">{member.name}</h4>
                      <p className="font-arimo text-[11px] text-[#667085] font-semibold tracking-wide uppercase">{formatRole(member.role)}</p>
                    </div>
                  </div>

                  {/* Badges & Progress Info */}
                  <div className="flex flex-col sm:items-end gap-2.5">
                    <div className="flex items-center gap-2">
                      {member.overdue > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold tracking-wider bg-red-100/80 backdrop-blur text-red-700 border border-red-200/50 uppercase whitespace-nowrap shadow-sm">
                          {member.overdue} OVERDUE
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 text-[12px] font-arimo font-semibold text-[#101828] bg-white/70 px-2.5 py-0.5 rounded-lg border border-white/80 shadow-sm backdrop-blur-sm">
                        {member.value} {member.value === 1 ? 'Task' : 'Tasks'}
                      </span>
                    </div>

                    {/* Progress Bar (Visible even if 0 tasks to keep grid aligned) */}
                    <div className="flex items-center gap-3 w-full sm:w-[140px]">
                      <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: member.value > 0 && member.completed === member.value ? '#00875A' : member.color }}>
                        {member.value > 0 ? Math.round((member.completed / member.value) * 100) : 0}%
                      </span>
                      <div className="h-2 w-full bg-black/5 rounded-full overflow-hidden shadow-inner flex-1 border border-white/40">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{
                            width: `${member.value > 0 ? (member.completed / member.value) * 100 : 0}%`,
                            backgroundColor: member.color
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Scroll Fade Indicator to hint scrollability */}
          <div className="absolute bottom-6 left-6 right-8 h-16 bg-gradient-to-t from-white/90 via-white/40 to-transparent pointer-events-none z-20 rounded-b-xl backdrop-blur-[1px]" />
        </div>

      </div>
    </MotionWrapper>
  );
}
