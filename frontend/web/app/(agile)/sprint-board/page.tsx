"use client";
import React from "react";
import Header from "./components/Header";
import Column from "./components/Column";
// import { motion } from "./components/motionShim";
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
      <div className="mx-auto bg-white shadow p-0 rounded-none" style={{ maxWidth: 'clamp(0px, calc(100% - 4cm), 1272px)' }}>
        <Header />

        <div className="px-[10px] py-2">
          <div className="overflow-x-auto">
            <div className="flex gap-4 pb-6 items-start">
              <div className="flex gap-4">
                <Column title="To Do" bg="bg-[#EFF6FF]" items={[]} />
                <Column title="In Progress" bg="bg-[#FFFEF0]" items={[]} />
                <Column title="In Review" bg="bg-[#FAF5FF]" items={[]} />
                <Column title="Done" bg="bg-[#F0FDF4]" items={[]} />
              </div>

              <div className="flex items-start">
                <button
                  aria-label="Add column"
                  title="Add column"
                  className="w-10 h-10 rounded-md bg-[#1D56D5] text-white flex items-center justify-center text-lg hover:bg-[#1648b8] focus:outline-none"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
