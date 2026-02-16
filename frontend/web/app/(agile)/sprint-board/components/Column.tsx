"use client";
import React from "react";
import type { Task } from "./types";
import TaskCard from "./TaskCard";

export default function Column({ title, bg, items }: { title: string; bg?: string; items?: Task[] }) {
  return (
    <div className="w-[320px] flex-shrink-0">
      <div className="flex items-center justify-between mb-3 px-2">
        <div className="uppercase text-xs text-slate-600 tracking-wide">{title}</div>
        <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center text-xs text-slate-600">{items?.length ?? 0}</div>
      </div>

      <div className={`${bg ?? "bg-white"} px-3 py-3 rounded-[12px] min-h-[360px] flex flex-col items-stretch gap-3 transition-colors duration-150`}>
        {(items ?? []).map((t) => (
          <TaskCard key={t.id} task={t} />
        ))}
      </div>
    </div>
  );
}
