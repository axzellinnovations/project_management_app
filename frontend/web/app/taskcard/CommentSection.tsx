"use client";
import React, { useState } from 'react';

const CommentSection = () => {
  const [activeTab, setActiveTab] = useState<'Comments' | 'History'>('Comments');

  return (
    <div className="mt-8">
      <div className="flex items-center gap-6 border-b border-gray-200 mb-4">
        {['Comments', 'History'].map((tab) => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab as 'Comments' | 'History')}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      
      <div className="flex gap-3">
        <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
          JD
        </div>
        <div className="flex-1">
          <input 
            type="text" 
            placeholder="Add a comment..." 
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-gray-400"
          />
          <div className="text-xs text-gray-400 mt-2">
            <strong>Pro tip:</strong> press <span className="bg-gray-100 border border-gray-300 px-1 rounded text-gray-600 font-mono">M</span> to comment
          </div>
        </div>
      </div>

      {/* Placeholder for list of comments */}
      {activeTab === 'Comments' && (
        <div className="mt-6 text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
           <p className="text-gray-400 text-sm">No comments yet.</p>
        </div>
      )}
    </div>
  );
};

export default CommentSection;