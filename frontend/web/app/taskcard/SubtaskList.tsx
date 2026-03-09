"use client";
import React from 'react';
import { CheckSquare } from 'lucide-react';

interface Subtask {
  id: number;
  title: string;
  status: string;
}

interface SubtaskListProps {
  subtasks: Subtask[];
}

const SubtaskList: React.FC<SubtaskListProps> = ({ subtasks }) => {
  const completedCount = subtasks.filter(t => t.status?.toUpperCase() === 'DONE').length;
  const progress = subtasks.length > 0 ? (completedCount / subtasks.length) * 100 : 0;

  if (subtasks.length === 0) {
    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-800">Subtasks</h3>
        </div>
        <p className="text-sm text-gray-400">No subtasks yet</p>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-800">Subtasks</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{completedCount} of {subtasks.length} done</span>
          <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-300" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>
      
      <div className="space-y-1">
        {subtasks.map((st) => {
          const isDone = st.status?.toUpperCase() === 'DONE';
          return (
            <div 
              key={st.id} 
              className="flex items-center justify-between p-2 hover:bg-gray-50 rounded group cursor-pointer border border-transparent hover:border-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <CheckSquare 
                  size={16} 
                  className={isDone ? "text-green-500" : "text-gray-400"} 
                />
                <span className={`text-sm font-medium ${isDone ? "text-gray-400 line-through" : "text-gray-500"}`}>
                  TASK-{st.id}
                </span>
                <span className={`text-sm ${isDone ? "text-gray-400 line-through" : "text-gray-800"}`}>
                  {st.title}
                </span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                  isDone ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {st.status}
              </span>
            </div>
          );
        })}
        
        <button className="mt-2 text-sm text-blue-600 hover:underline pl-2 flex items-center gap-1">
            <span>+</span> Create subtask
        </button>
      </div>
    </div>
  );
};

export default SubtaskList;