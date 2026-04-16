'use client';

import { useParams } from 'next/navigation';
import api from '@/lib/axios';
import { Task, Sprint, ProjectMetrics } from '@/types';
import useSWR from 'swr';

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

import { buildSessionCacheKey, getSessionCache, setSessionCache } from '@/lib/session-cache';

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function SummaryPage() {
    const params = useParams();
    const projectId = Number(params.projectId);

    const tasksCacheKey = buildSessionCacheKey('project-tasks', [projectId]);
    const cachedTasks = tasksCacheKey ? getSessionCache<Task[]>(tasksCacheKey, { allowStale: true }).data : undefined;

    const sprintsCacheKey = buildSessionCacheKey('project-sprints', [projectId]);
    const cachedSprints = sprintsCacheKey ? getSessionCache<Sprint[]>(sprintsCacheKey, { allowStale: true }).data : undefined;

    // Fetch primary data points using SWR & Session Cache for instant rendering
    const { data: tasks, isLoading: tasksLoading } = useSWR<Task[]>(
        projectId ? `/api/tasks/project/${projectId}` : null, 
        async (url) => {
            const data = await fetcher(url);
            if (tasksCacheKey) setSessionCache(tasksCacheKey, data, 2 * 60_000);
            return data;
        },
        {
            fallbackData: cachedTasks || undefined,
            revalidateOnFocus: false,
            dedupingInterval: 30000
        }
    );

    const { data: sprints, isLoading: sprintsLoading } = useSWR<Sprint[]>(
        projectId ? `/api/sprints/project/${projectId}` : null, 
        async (url) => {
            const data = await fetcher(url);
            if (sprintsCacheKey) setSessionCache(sprintsCacheKey, data, 2 * 60_000);
            return data;
        },
        {
            fallbackData: cachedSprints || undefined,
            revalidateOnFocus: false,
            dedupingInterval: 30000
        }
    );
    const { data: metrics, isLoading: metricsLoading } = useSWR<ProjectMetrics>(
        projectId ? `/api/projects/${projectId}/metrics` : null,
        fetcher
    );

    // Show full-page skeleton only for critical primary data (sprints/tasks/metrics)
    // SWR will skip this if data is cached!
    if (tasksLoading || sprintsLoading || metricsLoading || !tasks || !sprints || !metrics) {
        return <SummaryPageSkeleton />;
    }

    return (
        <div className="mobile-page-padding max-w-[1200px] mx-auto pb-6">

            {/* Metrics Section */}
            <div className="mb-6">
                <MetricsGrid metrics={metrics} />
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
                    <RecentActivity projectId={projectId} tasks={tasks} />
                    <ProjectTeam projectId={projectId} tasks={tasks} />
                </div>

            </div>
        </div>
    );
}
