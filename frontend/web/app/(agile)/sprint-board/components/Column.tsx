"use client";
import React from "react";
import { motion } from "framer-motion";
import type { Task } from "./types";
import TaskCard from "./TaskCard";

export default function Column({ title, bg, items }: { title: string; bg?: string; items?: Task[] }) {
  return (
    <motion.div className="w-[320px] flex-shrink-0" whileHover={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 300, damping: 28 }}>
      <div className="flex items-center justify-between mb-3 px-2">
        <div className="uppercase text-xs text-slate-600 tracking-wide">{title}</div>
        <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center text-xs text-slate-600">{items?.length ?? 0}</div>
      </div>

      <motion.div
        className={`${bg ?? "bg-white"} px-3 py-3 rounded-[12px] min-h-[360px] flex flex-col items-stretch gap-3`}
        whileHover={{ y: -4, boxShadow: "0 10px 30px rgba(2,6,23,0.08)" }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
      >
        {(items ?? []).map((t) => (
          <TaskCard key={t.id} task={t} />
        ))}
      </motion.div>
    </motion.div>
  );
}
