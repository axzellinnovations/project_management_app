'use client';

import React, { useState, useEffect } from 'react';
import { Edit3, Check, Loader2 } from 'lucide-react';
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
    <MotionWrapper className="flex flex-col h-full min-h-[220px]">


      <div className="flex-1 p-0 relative">
        {/* Floating Edit / Save button */}
        <div className="absolute top-2 right-3 z-10 flex items-center gap-2">
          {!isEditing && parsedDefault.author && (
            <span className="text-[10px] text-gray-400 font-arimo italic hidden sm:block">
              Last edited by <span className="font-semibold text-gray-500">{parsedDefault.author}</span>
            </span>
          )}
          {isEditing ? (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="bento-no-drag text-[11px] font-bold px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-100 hover:bg-amber-100 transition-colors flex items-center gap-1 shadow-sm"
            >
              {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="bento-no-drag text-[11px] font-bold px-2.5 py-1 rounded-md bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors flex items-center gap-1 shadow-sm"
            >
              <Edit3 size={12} />
              Edit
            </button>
          )}
        </div>

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
