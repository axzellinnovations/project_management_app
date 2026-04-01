'use client';

import { useParams } from "next/navigation";
import MetricsGrid from "../components/MetricsGrid";
import { ProjectTimeline, CurrentSprint } from "../components/ProjectTimeline";
import RecentActivity from "../components/RecentActivity";
import ProjectTeam from "../components/ProjectTeam";

export default function SummaryPage() {
    const params = useParams();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const projectId = params?.projectId as string | undefined;

    return (
        <div className="mobile-page-padding max-w-[1200px] mx-auto pb-28 sm:pb-8">
            {/* Metrics Section */}
            <div className="mb-6">
                <MetricsGrid />
            </div>

            {/* Main Grid: 2 Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Left Column (Timeline & Sprint) - Spans 2 cols */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <ProjectTimeline />
                    <CurrentSprint />
                </div>

                {/* Right Column (Activity & Team) - Spans 1 col */}
                <div className="flex flex-col gap-6">
                    <RecentActivity />
                    <ProjectTeam />
                </div>
            </div>
        </div>
    );
}
