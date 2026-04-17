import React, { useState } from 'react';
import MotionWrapper from '../MotionWrapper';
import { FileBarChart2, Loader2, Download, CheckCircle } from 'lucide-react';

export function GenerateReportCard({ projectId }: { projectId: number | string }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const handleGenerate = () => {
    setIsGenerating(true);
    
    // Simulate generation delay
    setTimeout(() => {
      setIsGenerating(false);
      setIsDone(true);
      
      // Reset back to original state after 4 seconds
      setTimeout(() => {
        setIsDone(false);
      }, 4000);
    }, 2000);
  };

  return (
    <MotionWrapper className="bg-gradient-to-r from-[#0052CC] to-[#2684FF] rounded-2xl border border-blue-400 p-5 shadow-lg shadow-blue-500/20 text-white relative overflow-hidden group">
      {/* Decorative Abstract Background Elements */}
      <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/20 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700" />
      <div className="absolute -top-4 -right-2 w-16 h-16 bg-white/20 rounded-full blur-xl animate-pulse" />
      
      <div className="absolute right-[-10px] top-[10px] text-white/5 rotate-[-15deg] pointer-events-none">
        <FileBarChart2 size={100} strokeWidth={1} />
      </div>

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col">
          <h3 className="font-arimo text-[16px] font-bold mb-1 text-white flex items-center gap-2">
            Project Overview Report
          </h3>
          <p className="font-arimo text-[12px] text-blue-100 opacity-90">
            Export a highly detailed PDF of tasks, sprints & workload.
          </p>
        </div>

        <button 
          onClick={handleGenerate}
          disabled={isGenerating || isDone}
          className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-arimo text-[13px] font-bold transition-all duration-300 transform active:scale-95 shadow-sm whitespace-nowrap
            ${isDone 
               ? 'bg-emerald-500 text-white border border-emerald-400 hover:bg-emerald-600 shadow-emerald-500/30' 
               : 'bg-white text-[#0052CC] border border-white hover:bg-blue-50 hover:shadow-md hover:shadow-white/20'
            } disabled:opacity-90 disabled:active:scale-100`}
        >
          {isGenerating ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Generating...
            </>
          ) : isDone ? (
            <>
              <CheckCircle size={16} />
              Downloaded
            </>
          ) : (
            <>
              <Download size={16} className="group-hover:translate-y-0.5 transition-transform" />
              Generate Report
            </>
          )}
        </button>
      </div>
    </MotionWrapper>
  );
}
