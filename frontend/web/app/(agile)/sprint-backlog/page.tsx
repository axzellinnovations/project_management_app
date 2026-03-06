"use client";
import React from "react";
import BacklogCard from "./components/BacklogCard";
import Sidebar from "@/app/nav/Sidebar";

export default function SprintBacklogPage() {
  return (
    <main className="w-full bg-[#F1F6F9] min-h-screen px-2 py-4 sm:px-4">
      <div className="mx-auto" style={{ maxWidth: 'clamp(0px, calc(100% - 4cm), 1194px)' }}>
        <div className="w-full mx-auto">
          <BacklogCard />
        </div>
      </div>
    </main>
  );
}
