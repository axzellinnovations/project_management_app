"use client";
import React from "react";
import Header from "./components/Header";
import Column from "./components/Column";
// import { motion } from "./components/motionShim";
export default function SprintBoardPage() {
  return (
    <main className="w-full bg-[#F1F6F9] min-h-full px-[10px] py-2 pb-28 sm:pb-8">
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
