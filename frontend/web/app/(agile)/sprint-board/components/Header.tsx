"use client";
import React from "react";

export default function Header() {
  return (
    <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-[10px] py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="text-[16px] font-normal text-slate-800">Sprint Board</div>
          <div className="flex items-center relative w-[128px] h-8">
            <div className="w-8 h-8 rounded-full bg-gray-200 border border-white" />
            <div className="w-8 h-8 rounded-full bg-gray-200 border border-white -ml-2" />
            <div className="w-8 h-8 rounded-full bg-gray-200 border border-white -ml-2" />
            <div className="w-8 h-8 rounded-full bg-gray-200 border border-white -ml-2" />
            <div className="w-8 h-8 rounded-full bg-gray-300 border border-white -ml-2 flex items-center justify-center text-xs text-gray-600">+3</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <input className="w-64 h-9 rounded-md border border-gray-300 pl-10 pr-3" placeholder="Search tasks..." />
            <div className="absolute left-2 top-2 text-gray-400">🔍</div>
          </div>
          <button className="w-[134px] h-[33.6px] bg-[#1D56D5] border border-[#1D56D5] rounded-[10px] text-white transition transform hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-[#1648B8] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#1D56D5]">
            Complete Sprint
          </button>
        </div>
      </div>
    </div>
  );
}
