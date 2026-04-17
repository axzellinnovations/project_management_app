import React from 'react';
import { Task, PageItem, MilestoneResponse } from '@/types';
import api from '@/lib/axios';
import useSWR from 'swr';
import { RecentActivityFeedCard } from './recent-activity/RecentActivityFeedCard';
import { RecentlyCompletedTasksCard } from './recent-activity/RecentlyCompletedTasksCard';
import { DueTasksFiveDaysCard } from './recent-activity/DueTasksFiveDaysCard';
import { UpcomingMilestonesCard } from './recent-activity/UpcomingMilestonesCard';
import { ProjectDocsCard } from './recent-activity/ProjectDocsCard';
import { GenerateReportCard } from './recent-activity/GenerateReportCard';

export default function RecentActivity({ projectId, tasks = [] }: { projectId: number, tasks?: Task[] }) {
    const fetcher = (url: string) => api.get(url).then(res => res.data);
    const { data: pages = [], isLoading: pagesLoading } = useSWR<PageItem[]>(
        projectId ? `/api/projects/${projectId}/pages` : null,
        fetcher
    );
    const { data: milestones = [], isLoading: milestonesLoading } = useSWR<MilestoneResponse[]>(
        projectId ? `/api/projects/${projectId}/milestones` : null,
        fetcher
    );

    return (
        <div className="flex flex-col gap-6">
            <GenerateReportCard projectId={projectId} />
            <RecentlyCompletedTasksCard tasks={tasks} />
            <RecentActivityFeedCard tasks={tasks} />
            <DueTasksFiveDaysCard tasks={tasks} />
            <UpcomingMilestonesCard projectId={projectId} milestones={milestones} milestonesLoading={milestonesLoading} />
            <ProjectDocsCard projectId={projectId} pages={pages} pagesLoading={pagesLoading} />
        </div>
    );
}
