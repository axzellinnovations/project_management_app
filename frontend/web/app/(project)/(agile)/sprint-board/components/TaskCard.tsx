"use client";
import React from "react";
import { motion } from "framer-motion";
import type { Task } from "./types";

export default function TaskCard({ task }: { task: Task }) {
  return (
    <motion.div
      className="bg-white rounded-lg shadow p-3 w-full"
      whileHover={{ y: -6 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div className="font-medium text-sm text-slate-900">{task.title}</div>
      <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gray-200" />
          <div>{task.assignees?.[0]}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-2 py-1 bg-gray-100 rounded text-xs">{task.subtasks}</div>
          <div className="text-xs text-gray-500">{task.due}</div>
        </div>
      </div>
    </motion.div>
  );
}
