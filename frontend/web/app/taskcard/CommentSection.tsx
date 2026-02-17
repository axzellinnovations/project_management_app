"use client";
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/axios';
import { getUserFromToken } from '@/lib/auth';

interface Comment {
  id: number;
  text: string;
  authorName: string;
  createdAt: string;
}

interface CommentSectionProps {
  taskId?: number;
}

const CommentSection: React.FC<CommentSectionProps> = ({ taskId }) => {
  const [activeTab, setActiveTab] = useState<'Comments' | 'History'>('Comments');
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ username?: string; email: string } | null>(null);

  useEffect(() => {
    const user = getUserFromToken();
    setCurrentUser(user);
  }, []);

  const handleAddComment = async () => {
    if (!newComment.trim() || !taskId) return;

    try {
      setLoading(true);
      await api.post(`/api/tasks/${taskId}/comments`, {
        text: newComment
      });
      setNewComment('');
      // Optionally refresh comments, but for now just clear the input
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUserInitial = () => {
    if (!currentUser) return 'U';
    return (currentUser.username?.[0] || currentUser.email[0]).toUpperCase();
  };

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
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
          {getUserInitial()}
        </div>
        <div className="flex-1">
          <input 
            type="text" 
            placeholder="Add a comment..." 
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAddComment();
              }
            }}
            disabled={loading}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-gray-400 disabled:bg-gray-100"
          />
          <div className="text-xs text-gray-400 mt-2">
            <strong>Pro tip:</strong> press <span className="bg-gray-100 border border-gray-300 px-1 rounded text-gray-600 font-mono">Enter</span> to comment
          </div>
        </div>
      </div>

      {/* Comments List */}
      {activeTab === 'Comments' && (
        <div className="mt-6">
          {comments.length > 0 ? (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3 pb-4 border-b border-gray-100">
                  <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {comment.authorName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">{comment.authorName}</span>
                      <span className="text-xs text-gray-500">{new Date(comment.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{comment.text}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <p className="text-gray-400 text-sm">No comments yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentSection;