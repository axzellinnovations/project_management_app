'use client';
import React from 'react';
import Image from 'next/image';

interface CommentItemProps {
  comment: {
    id: number;
    text: string;
    authorName: string;
    createdAt: string;
  };
  resolvedPicUrl?: string;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, resolvedPicUrl }) => (
  <div className="flex gap-3 pb-4 border-b border-gray-100">
    <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
      {resolvedPicUrl ? (
        <Image
          src={resolvedPicUrl}
          alt={comment.authorName}
          width={32}
          height={32}
          className="w-full h-full object-cover"
          unoptimized
        />
      ) : (
        comment.authorName.charAt(0).toUpperCase()
      )}
    </div>
    <div className="flex-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-800">{comment.authorName}</span>
        <span className="text-xs text-gray-500">{new Date(comment.createdAt).toLocaleString()}</span>
      </div>
      <p className="text-sm text-gray-600 mt-1">{comment.text}</p>
    </div>
  </div>
);

export default CommentItem;
