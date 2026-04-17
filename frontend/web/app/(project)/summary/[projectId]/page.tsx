'use client';

import { useParams } from 'next/navigation';
import api from '@/lib/axios';
import { Task, Sprint, ProjectMetrics } from '@/types';
import useSWR from 'swr';
import { isAgileProjectType } from '@/components/shared/ProjectTypeIcon';

import MetricsGrid from "../components/MetricsGrid";
import { CurrentSprint } from "../components/ProjectTimeline";
import SummaryPageSkeleton from "../components/SummarySkeleton";
import dynamic from 'next/dynamic';

const DashboardCharts = dynamic(() => import('../components/DashboardCharts'), {
    ssr: false,
    loading: () => <div className="h-[250px] bg-gray-50 animate-pulse rounded-xl" />
});

// Lazy load secondary components
const RecentActivity = dynamic(() => import('../components/RecentActivity'), {
    ssr: false,
    loading: () => <div className="h-[200px] bg-gray-50 animate-pulse rounded-xl" />
});

const ProjectTeam = dynamic(() => import('../components/ProjectTeam'), {
    ssr: false,
    loading: () => <div className="h-[200px] bg-gray-50 animate-pulse rounded-xl" />
});

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function SummaryPage() {
    const params = useParams();
    const projectId = Number(params.projectId);

    // Fetch primary data points using SWR for caching and non-blocking background updates
    const { data: tasks, isLoading: tasksLoading } = useSWR<Task[]>(
        projectId ? `/api/tasks/project/${projectId}` : null, 
        fetcher
    );
    const { data: sprints, isLoading: sprintsLoading } = useSWR<Sprint[]>(
        projectId ? `/api/sprints/project/${projectId}` : null, 
        fetcher
    );
    const { data: metrics, isLoading: metricsLoading } = useSWR<ProjectMetrics>(
        projectId ? `/api/projects/${projectId}/metrics` : null,
        fetcher
    );
    const { data: projectDetails, isLoading: projectLoading } = useSWR<{ type?: string }>(
        projectId ? `/api/projects/${projectId}` : null,
        fetcher
    );

    const isAgileProject = isAgileProjectType(projectDetails?.type);

    // Show full-page skeleton only for critical primary data (sprints/tasks/metrics)
    // SWR will skip this if data is cached!
    if (tasksLoading || sprintsLoading || metricsLoading || projectLoading || !tasks || !sprints || !metrics || !projectDetails) {
        return <SummaryPageSkeleton />;
    }

    return (
        <div className="mobile-page-padding max-w-[1200px] mx-auto pb-6">

            {/* Metrics Section */}
            <div className="mb-6">
                <MetricsGrid metrics={metrics} />
            </div>

            {isAgileProject ? (
                /* Main Grid: Agile layout */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    <div className="lg:col-span-2 flex flex-col gap-6">
                        <CurrentSprint projectId={projectId} sprints={sprints} tasks={tasks} />
                        <DashboardCharts tasks={tasks} sprints={sprints} isAgile />
                    </div>

                    <div className="flex flex-col gap-6">
                        <RecentActivity projectId={projectId} tasks={tasks} />
                        <ProjectTeam projectId={projectId} tasks={tasks} />
                    </div>
                </div>
            ) : (
                /* Main Grid: Kanban layout (no sprint-specific widgets) */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        <DashboardCharts tasks={tasks} sprints={sprints} isAgile={false} />
                    </div>

                    <div className="lg:col-span-2 grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                        <RecentActivity projectId={projectId} tasks={tasks} />
                        <ProjectTeam projectId={projectId} tasks={tasks} />
                    </div>
                </div>
            )}
        </div>
    );
}
