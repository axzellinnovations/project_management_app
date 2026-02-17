"use client";
import React from "react";
import Header from "./components/Header";
import Column from "./components/Column";
import type { Task } from "./components/types";

const tasks: Task[] = [
  { id: "1", title: "Implement feedback collector", assignees: ["Sarah Chen"], due: "Nov 17, 2025", subtasks: 5 },
  { id: "2", title: "Design user onboarding flow", assignees: ["Michael Rodriguez"], due: "Nov 18, 2025", subtasks: 8 },
  { id: "3", title: "Update API documentation", assignees: ["Emma Watson"], due: "Nov 19, 2025", subtasks: 3 },
  { id: "4", title: "Build authentication module", assignees: ["James Park"], due: "Nov 15, 2025", subtasks: 13 },
];

export default function SprintBoardPage() {
  return (
    <main className="w-full bg-[#F1F6F9] min-h-screen px-[10px] py-2">
      <div className="mx-auto max-w-[1272px] bg-white shadow p-0 rounded-none">
        <Header />

        <div className="px-[10px] py-2">
          <div className="overflow-x-auto">
            <div className="flex gap-4 pb-6">
              <Column title="To Do" bg="bg-[#EFF6FF]" items={tasks} />
              <Column title="In Progress" bg="bg-[#FFFEF0]" items={tasks.slice(0, 2)} />
              <Column title="In Review" bg="bg-[#FAF5FF]" items={tasks.slice(1, 3)} />
              <Column title="Done" bg="bg-[#F0FDF4]" items={tasks.slice(2)} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
