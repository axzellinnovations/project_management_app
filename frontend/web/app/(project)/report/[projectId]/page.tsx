'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import api from '@/lib/axios';
import { Task, Sprint, ProjectMetrics, MilestoneResponse, TeamMemberInfo } from '@/types';
import { isAgileProjectType } from '@/components/shared/ProjectTypeIcon';
import dynamic from 'next/dynamic';

const ReportPageContent = dynamic(
  () => import('../components/ReportPageContent'),
  { ssr: false }
);

const fetcher = (url: string) => api.get(url).then(r => r.data);

export default function ReportPage() {
  const params    = useParams();
  const projectId = Number(params.projectId);

  const { data: tasks      = [] } = useSWR<Task[]>            (projectId ? `/api/tasks/project/${projectId}`       : null, fetcher);
  const { data: sprints    = [] } = useSWR<Sprint[]>          (projectId ? `/api/sprints/project/${projectId}`     : null, fetcher);
  const { data: metrics,   isLoading: mL } = useSWR<ProjectMetrics>(projectId ? `/api/projects/${projectId}/metrics` : null, fetcher);
  const { data: project,   isLoading: pL } = useSWR           (projectId ? `/api/projects/${projectId}`           : null, fetcher);
  const { data: milestones = [] } = useSWR<MilestoneResponse[]>(projectId ? `/api/projects/${projectId}/milestones`: null, fetcher);
  const { data: members    = [] } = useSWR<TeamMemberInfo[]>  (projectId ? `/api/projects/${projectId}/members`   : null, fetcher);

  if (mL || pL || !metrics || !project) {
    return (
      <div className="w-full min-h-[calc(100vh-130px)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 animate-pulse" />
          <span className="text-sm text-slate-400 font-medium">Loading project data…</span>
        </div>
      </div>
    );
  }

  return (
    <ReportPageContent
      projectId={projectId}
      tasks={tasks}
      sprints={sprints}
      metrics={metrics}
      project={project}
      milestones={milestones}
      members={members}
      isAgile={isAgileProjectType(project?.type)}
    />
  );
}
