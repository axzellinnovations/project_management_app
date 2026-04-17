'use client';

import React, { useState, useEffect } from 'react';
import { StickyNote, Edit3, Check, Loader2 } from 'lucide-react';
import MotionWrapper from './MotionWrapper';
import { updateProjectDetails } from '@/services/projects-service';
import useSWR, { mutate } from 'swr';
import { toast } from '@/components/ui/Toast';
import api from '@/lib/axios';

const DELIMITER = '|||AUTHOR:';

function parseNote(raw: string) {
  if (!raw) return { text: '', author: '' };
  const parts = raw.split(DELIMITER);
  if (parts.length >= 2) {
    return { text: parts[0], author: parts[1] };
  }
  return { text: raw, author: '' };
}

function serializeNote(text: string, author: string) {
  if (!author) return text;
  return text + DELIMITER + author;
}

export function ProjectNoteWidget({ projectId, defaultNote = '' }: { projectId: number | string; defaultNote?: string }) {
  const parsedDefault = parseNote(defaultNote);
  const [isEditing, setIsEditing] = useState(false);
  const [note, setNote] = useState(parsedDefault.text);
  const [isSaving, setIsSaving] = useState(false);
  
  // Fetch the current user to tag exactly who updated the note.
  const { data: currentUser } = useSWR('/api/user/me', (url) => api.get(url).then(res => res.data));
  const authorName = currentUser?.fullName || currentUser?.username || 'Team Member';
  
  useEffect(() => {
    if (!isEditing) {
      setNote(parseNote(defaultNote).text);
    }
  }, [defaultNote, isEditing]);

  const handleSave = async () => {
    if (note === parsedDefault.text) {
      setIsEditing(false);
      return;
    }
    
    setIsSaving(true);
    try {
      const payloadString = serializeNote(note, authorName);
      await updateProjectDetails(projectId, { description: payloadString });
      
      // Update SWR cache locally
      mutate(`/api/projects/${projectId}`);
      setIsEditing(false);
      toast('Project note updated', 'success');
    } catch (err) {
      console.error(err);
      toast('Failed to update project note', 'error');
      setNote(parsedDefault.text);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MotionWrapper className="bg-white rounded-xl border border-[#E3E8EF] flex flex-col shadow-sm hover:shadow-md transition-all duration-200 group h-full min-h-[220px]">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0 relative">
         <h2 className="font-arimo text-[15px] font-semibold text-[#101828] flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
              <path d="M14 3v5h5M16 13H8M16 17H8M10 9H8"/>
            </svg>
            Project Note
         </h2>
         <div className="flex items-center gap-3">
            {!isEditing && parsedDefault.author && (
              <span className="text-[10px] text-gray-400 font-arimo italic hidden sm:block">
                Last updated by <span className="font-semibold text-gray-500">{parsedDefault.author}</span>
              </span>
            )}
            {isEditing ? (
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-100 hover:bg-amber-100 transition-colors flex items-center gap-1"
              >
                {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            ) : (
              <button 
                onClick={() => setIsEditing(true)}
                className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              >
                <Edit3 size={12} />
                Edit
              </button>
            )}
         </div>
      </div>
      
      <div className="flex-1 p-0 relative">
         {isEditing ? (
           <textarea 
             autoFocus
             value={note}
             onChange={e => setNote(e.target.value)}
             placeholder="Jot down important rules, goals, or notes for this project..."
             className="w-full h-full min-h-[160px] p-4 resize-none bg-amber-50/20 text-[13px] font-arimo text-gray-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-200 transition-all border-none rounded-b-xl"
           />
         ) : (
           <div 
             className="w-full h-full min-h-[160px] p-4 overflow-y-auto text-[13px] font-arimo text-gray-800 whitespace-pre-wrap cursor-text rounded-b-xl hover:bg-gray-50/50 transition-colors"
             onClick={() => setIsEditing(true)}
           >
             {note ? note : <span className="text-gray-400 italic">Click to write a shared project note or summary...</span>}
           </div>
         )}
         {!isEditing && parsedDefault.author && (
            <div className="sm:hidden absolute bottom-2 right-3 text-[9px] text-gray-400 font-arimo italic">
               Updated by {parsedDefault.author}
            </div>
         )}
      </div>
    </MotionWrapper>
  );
}
