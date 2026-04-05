'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/axios';
import { Task, Sprint, TeamMemberInfo, PageItem, Project } from '@/types';

import MetricsGrid from "../components/MetricsGrid";
import { CurrentSprint } from "../components/ProjectTimeline";
import RecentActivity from "../components/RecentActivity";
import ProjectTeam from "../components/ProjectTeam";
import DashboardCharts from "../components/DashboardCharts";
import { Loader2 } from "lucide-react";

export default function SummaryPage() {
    const params = useParams();
    const projectId = Number(params.projectId);

    const [tasks, setTasks] = useState<Task[]>([]);
    const [sprints, setSprints] = useState<Sprint[]>([]);
    const [members, setMembers] = useState<TeamMemberInfo[]>([]);
    const [pages, setPages] = useState<PageItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!projectId) return;

        const fetchData = async () => {
            try {
                // Fetch all data points concurrently
                const [
                    _projRes,
                    tasksRes,
                    sprintsRes,
                    membersRes,
                    pagesRes
                ] = await Promise.all([
                    api.get(`/api/projects/${projectId}`),
                    api.get(`/api/tasks/project/${projectId}`),
                    api.get(`/api/sprints/project/${projectId}`),
                    api.get(`/api/projects/${projectId}/members`),
                    api.get(`/api/projects/${projectId}/pages`),
                ]);

                setTasks(tasksRes.data);
                setSprints(sprintsRes.data);
                setMembers(membersRes.data);
                setPages(pagesRes.data);
            } catch (error) {
                console.error("Error fetching summary data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [projectId]);

    if (isLoading) {
        return (
            <div className="h-[50vh] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#0052CC]" />
            </div>
        );
    }

    return (
        <div className="mobile-page-padding max-w-[1200px] mx-auto pb-28 sm:pb-8">
            
            {/* Sub Header Content Removed */}

            {/* Metrics Section */}
            <div className="mb-6">
                <MetricsGrid tasks={tasks} />
            </div>

            {/* Main Grid: 2 Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* Left Column (Timeline & Sprint) - Spans 2 cols */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <CurrentSprint projectId={projectId} sprints={sprints} tasks={tasks} />
                    <DashboardCharts tasks={tasks} sprints={sprints} />
                </div>

                {/* Right Column (Activity & Team) - Spans 1 col */}
                <div className="flex flex-col gap-6">
                    <RecentActivity tasks={tasks} pages={pages} />
                    <ProjectTeam projectId={projectId} tasks={tasks} members={members} />
                </div>

            </div>
        </div>
    );
}
