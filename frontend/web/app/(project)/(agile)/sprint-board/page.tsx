'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { DragEndEvent } from '@dnd-kit/core';
import { useSearchParams, useRouter } from 'next/navigation';
import { Sprintboard, SprintboardTask } from './types';
import { fetchSprintboardBySprintId, moveTaskToColumn, fetchSprintsByProject, completeSprint, addColumn } from './api';
import SprintBoardHeader from './components/SprintBoardHeader';
import SprintColumn from './components/SprintColumn';
import SprintDragDropProvider from './components/SprintDragDropProvider';
import CreateColumnModal from './components/CreateColumnModal';
import { Loader, AlertCircle, CheckCircle2, Plus, Check, X } from 'lucide-react';
import axios from '@/lib/axios';
import { AxiosError } from 'axios';
import { toast } from '@/components/ui';
import TaskCardModal from '@/app/taskcard/TaskCardModal';
import { buildSessionCacheKey, getSessionCache, setSessionCache, removeSessionCache } from '@/lib/session-cache';

type SprintBoardCache = { activeList: SprintSummary[]; boards: Sprintboard[] };

interface SprintSummary {
  id: number;
  status: string;
  sprintName?: string;
}

export default function SprintBoardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectIdStr = searchParams.get('projectId');

  const [allBoards, setAllBoards] = useState<Sprintboard[]>([]);
  const [allActiveSprints, setAllActiveSprints] = useState<SprintSummary[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [isAgile, setIsAgile] = useState<boolean | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [sprintIdToComplete, setSprintIdToComplete] = useState<number | null>(null);

  // Derived from selected index
  const sprintboard = allBoards[selectedIdx] ?? null;
  const activeSprint = allActiveSprints[selectedIdx] ?? null;

  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [isCreatingColumn, setIsCreatingColumn] = useState(false);

  const toColumnStatus = (name: string) =>
    name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');

  // ── Static Project Data (Run once per projectId) ──
  const fetchProjectInfo = useCallback(async () => {
    if (!projectIdStr) return;
    try {
      const res = await axios.get(`/api/projects/${projectIdStr}`);
      setIsAgile(res.data.type === 'AGILE' || res.data.type === 'Agile Scrum' || res.data.type === 'SCRUM');
    } catch (err) {
      console.error('Failed to fetch project info:', err);
      setIsAgile(false);
    }
  }, [projectIdStr]);

  // ── Dynamic Sprint/Board Data (Periodic Sync) ──
  const fetchData = useCallback(async (options: { showSpinner?: boolean, forceNetwork?: boolean } = {}) => {
    if (!projectIdStr) return;
    const { showSpinner = true, forceNetwork = false } = options;
    const pid = parseInt(projectIdStr);

    const cKey = buildSessionCacheKey('sprint-board', [projectIdStr]);
    if (cKey && !forceNetwork) {
      const cached = getSessionCache<SprintBoardCache>(cKey, { allowStale: true });
      if (cached.data) {
        setAllActiveSprints(cached.data.activeList);
        setAllBoards(cached.data.boards);
        setLoading(false);
        if (!cached.isStale) return; // Fresh cache
      }
    }

    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const sprints = await fetchSprintsByProject(pid) as SprintSummary[];
      const activeList = sprints.filter((s) => s.status === 'ACTIVE');

      if (activeList.length === 0) {
        setAllActiveSprints([]);
        setAllBoards([]);
        setLoading(false);
        return;
      }

      const boards = await Promise.all(activeList.map(s => fetchSprintboardBySprintId(s.id)));
      setAllActiveSprints(activeList);
      setAllBoards(boards);
      
      if (cKey) {
        setSessionCache(cKey, { activeList, boards }, 30 * 60_000);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (showSpinner) setError(err.response?.data?.message || 'Failed to load sprint board.');
    } finally {
      setLoading(false);
    }
  }, [projectIdStr]);

  const forceRefresh = useCallback(() => void fetchData({ showSpinner: false, forceNetwork: true }), [fetchData]);

  useEffect(() => {
    if (!projectIdStr) return;
    void fetchProjectInfo();
    void fetchData({ showSpinner: true });
    const syncId = setInterval(() => void fetchData({ showSpinner: false }), 30_000);
    return () => clearInterval(syncId);
  }, [projectIdStr, fetchProjectInfo, fetchData]);

  // Search filter
  const filteredColumns = useMemo(() => {
    if (!sprintboard) return [];

    return sprintboard.columns.map(col => ({
      ...col,
      tasks: col.tasks.filter(task =>
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.assigneeName?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }));
  }, [sprintboard, searchTerm]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !sprintboard) return;

    const taskId = parseInt(active.id as string);
    const newStatus = over.id as string;

    let taskToMove: SprintboardTask | undefined;
    let oldColumnStatus: string | undefined;

    for (const col of sprintboard.columns) {
      const found = col.tasks.find(t => t.taskId === taskId);
      if (found) {
        taskToMove = found;
        oldColumnStatus = col.columnStatus;
        break;
      }
    }

    if (!taskToMove || oldColumnStatus === newStatus) return;

    // Optimistic Update
    const newColumns = sprintboard.columns.map(col => {
      if (col.columnStatus === oldColumnStatus) {
        return { ...col, tasks: col.tasks.filter(t => t.taskId !== taskId) };
      }
      if (col.columnStatus === newStatus) {
        return { ...col, tasks: [...col.tasks, { ...taskToMove!, status: newStatus }] };
      }
      return col;
    });

    setAllBoards(prev => prev.map((b, i) => i === selectedIdx ? { ...b, columns: newColumns } : b));

    try {
      await moveTaskToColumn(taskId, sprintboard.id, newStatus);
      const cKey = buildSessionCacheKey('sprint-board', [projectIdStr]);
      if (cKey) removeSessionCache(cKey);
      forceRefresh();
    } catch (_err) {
      void fetchData({ showSpinner: false, forceNetwork: true });
    }
  };

  const handleInlineCreateTask = useCallback(async (title: string, status: string) => {
    if (!projectIdStr || !activeSprint || !sprintboard) return;
    try {
      const res = await axios.post('/api/tasks', {
        title,
        status,
        projectId: parseInt(projectIdStr),
        sprintId: activeSprint.id,
        storyPoint: 0,
        priority: 'MEDIUM',
      });
      const newTask: SprintboardTask = {
        taskId: res.data.id,
        title: res.data.title,
        storyPoint: res.data.storyPoint ?? 0,
        status,
        priority: res.data.priority ?? 'MEDIUM',
        assigneeName: res.data.assigneeName,
        assigneePhotoUrl: res.data.assigneePhotoUrl ?? null,
      };
      setAllBoards(prev => prev.map((b, i) => {
        if (i !== selectedIdx) return b;
        return {
          ...b,
          columns: b.columns.map(col =>
            col.columnStatus === status
              ? { ...col, tasks: [...col.tasks, newTask] }
              : col
          ),
        };
      }));
      const cKey = buildSessionCacheKey('sprint-board', [projectIdStr]);
      if (cKey) removeSessionCache(cKey);
      forceRefresh();
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      toast(axiosErr?.response?.data?.message || 'Failed to create task.', 'error');
    }
  }, [projectIdStr, activeSprint, sprintboard, selectedIdx, forceRefresh]);

  const handleCompleteSprint = async () => {
    const targetId = sprintIdToComplete;
    if (!targetId) return;

    setIsUpdating(true);
    try {
      await completeSprint(targetId);
      // Update UI state
      setAllActiveSprints(prev => prev.filter(s => s.id !== targetId));
      setAllBoards(prev => {
        const idxToRemove = allActiveSprints.findIndex(s => s.id === targetId);
        return prev.filter((_, i) => i !== idxToRemove);
      });
      setSelectedIdx(0);
      setShowCompleteConfirm(false);
      setSuccessMsg('Sprint completed successfully!');
      setTimeout(() => setSuccessMsg(''), 2000);
      const cKey = buildSessionCacheKey('sprint-board', [projectIdStr]);
      if (cKey) removeSessionCache(cKey);
      forceRefresh();
    } catch (_err) {
      toast('Failed to complete sprint.', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  // Removing handleAddColumn as it reached deprecation after UI shift.

  const finalizeAddColumn = async (name: string, status: string) => {
    if (!sprintboard) return;
    setIsCreatingColumn(true);
    try {
      await addColumn(sprintboard.id, name, status);
      setSuccessMsg(`Column "${name}" added!`);
      setTimeout(() => setSuccessMsg(''), 2000);
      setIsAddingColumn(false);
      setNewColumnName('');
      const cKey = buildSessionCacheKey('sprint-board', [projectIdStr]);
      if (cKey) removeSessionCache(cKey);
      void fetchData({ showSpinner: false, forceNetwork: true });
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      const msg = axiosErr?.response?.data?.message || axiosErr?.message || 'Failed to add column.';
      toast(msg, 'error');
    } finally {
      setIsCreatingColumn(false);
    }
  };

  if (!projectIdStr) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center">
        <div className="text-center p-8 bg-white rounded-2xl shadow-xl max-w-sm">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#101828]">Missing Project</h2>
          <p className="text-[#475467] text-sm mt-2">Please select a project to view its sprint board.</p>
        </div>
      </div>
    );
  }

  // Still evaluating agile status
  if (isAgile === null) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <Loader className="w-8 h-8 text-[#155DFC] animate-spin" />
        </div>
      );
  }

  if (!isAgile) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50 h-full">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center p-10 bg-white rounded-3xl shadow-sm border border-[#EAECF0] max-w-lg">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-[#155DFC]" />
            </div>
            <h2 className="text-2xl font-bold text-[#101828]">Kanban Projects don&apos;t have Sprints</h2>
            <p className="text-[#475467] mt-3">The Sprint Board is exclusive to <span className="font-bold text-[#155DFC]">Agile</span> projects. Please switch to the regular Kanban Board for this project.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-[#F9FAFB] overflow-hidden">

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader className="w-8 h-8 text-[#155DFC] animate-spin" />
              <p className="text-[14px] font-medium text-[#475467]">Loading Sprint Board...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
              <h2 className="text-lg font-bold text-[#101828]">Sprint Board not ready</h2>
              <p className="text-[#475467] text-sm mt-2 mb-6">{error}</p>
              <button
                onClick={() => forceRefresh()}
                className="px-4 py-2 bg-white border border-[#EAECF0] rounded-xl text-sm font-semibold hover:bg-gray-50 shadow-sm"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : !sprintboard ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-sm">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-gray-300" />
              </div>
              <h2 className="text-xl font-bold text-[#101828]">No active sprint</h2>
              <p className="text-[#475467] text-sm mt-2">
                <button
                  onClick={() => router.push(`/sprint-backlog?projectId=${projectIdStr}`)}
                  className="text-[#155DFC] font-semibold hover:underline"
                >
                  Start a sprint
                </button>
                {' '}in the backlog to see progress here.
              </p>
            </div>
          </div>
        ) : (
          <>
            <SprintBoardHeader
              sprintName={sprintboard.sprintName}
              allActiveSprints={allActiveSprints}
              selectedIdx={selectedIdx}
              onSelectSprint={setSelectedIdx}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onCompleteSprint={() => {
                  setSprintIdToComplete(activeSprint?.id || null);
                  setShowCompleteConfirm(true);
              }}
              isLoading={isUpdating}
            />

            {/* Complete Sprint Confirmation Dialog */}
            {showCompleteConfirm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl border border-[#EAECF0] p-6 max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-[#FEF3F2] flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 size={24} className="text-[#D92D20]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[#101828]">Complete Sprint</h3>
                      <p className="text-xs text-[#475467] mt-0.5 uppercase tracking-wider font-bold">This cannot be undone</p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-8">
                    <p className="text-sm text-[#344054]">
                        {allActiveSprints.length > 1 
                          ? "Select the active sprint you want to complete:" 
                          : "Are you sure you want to complete this sprint?"}
                    </p>
                    
                    {allActiveSprints.length > 1 ? (
                        <div className="flex flex-col gap-2">
                            {allActiveSprints.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => setSprintIdToComplete(s.id)}
                                    className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                                        sprintIdToComplete === s.id 
                                        ? 'border-[#155DFC] bg-blue-50/50' 
                                        : 'border-[#EAECF0] hover:border-gray-300'
                                    }`}
                                >
                                    <div className="text-left">
                                        <p className={`text-sm font-bold ${sprintIdToComplete === s.id ? 'text-[#155DFC]' : 'text-[#101828]'}`}>
                                            {s.sprintName || `Sprint #${s.id}`}
                                        </p>
                                        <p className="text-[11px] text-[#667085] mt-0.5">Tasks will be moved out of board</p>
                                    </div>
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                        sprintIdToComplete === s.id ? 'border-[#155DFC] bg-[#155DFC]' : 'border-[#D0D5DD]'
                                    }`}>
                                        {sprintIdToComplete === s.id && <div className="w-2 h-2 rounded-full bg-white" />}
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-[#F9FAFB] border border-[#EAECF0] rounded-2xl p-4">
                            <p className="text-sm font-bold text-[#101828]">{activeSprint?.sprintName || `Sprint #${activeSprint?.id}`}</p>
                            <p className="text-xs text-[#667085] mt-1">The sprint will be marked as complete and moved to history.</p>
                        </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowCompleteConfirm(false)}
                      className="flex-1 px-4 py-3 border border-[#D0D5DD] rounded-xl text-sm font-bold text-[#344054] hover:bg-[#F9FAFB] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCompleteSprint}
                      disabled={isUpdating || !sprintIdToComplete}
                      className="flex-1 px-4 py-3 bg-[#D92D20] hover:bg-[#B42318] text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-red-500/10"
                    >
                      {isUpdating ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <CheckCircle2 size={18} />
                      )}
                      Complete Sprint
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-x-auto p-4 md:p-8 snap-x snap-mandatory hide-scrollbar">
              {successMsg && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4">
                  <div className="px-6 py-3 bg-[#ECFDF3] border border-[#6CE9A6] text-[#027A48] rounded-xl shadow-lg flex items-center gap-3 font-semibold text-sm">
                    <CheckCircle2 size={18} />
                    {successMsg}
                  </div>
                </div>
              )}

              <SprintDragDropProvider tasks={sprintboard.columns.flatMap(c => c.tasks)} onDragEnd={handleDragEnd}>
                <div className="flex items-start gap-5 md:gap-8 h-full min-h-[calc(100vh-250px)] pb-10">
                  {filteredColumns.map(column => (
                    <SprintColumn
                      key={column.id}
                      column={column}
                      onInlineCreate={handleInlineCreateTask}
                      onOpenTask={(id) => setSelectedTaskId(id)}
                    />
                  ))}

                  {/* Add Column Button / Inline Input */}
                  <div className="flex flex-col flex-shrink-0 h-full min-h-[500px]">
                    {!isAddingColumn ? (
                      <button
                        onClick={() => {
                          setIsAddingColumn(true);
                          setTimeout(() => document.getElementById('new-column-input')?.focus(), 50);
                        }}
                        className="relative flex flex-col items-center pt-12 w-14 hover:w-20 h-full border-r-2 border-dashed border-[#EAECF0]/80 hover:bg-white/80 hover:border-[#155DFC]/30 transition-all duration-300 group active:scale-[0.98] cursor-pointer"
                      >
                        <div className="relative w-10 h-10 rounded-full bg-white border border-[#EAECF0] shadow-sm flex items-center justify-center group-hover:ring-8 group-hover:ring-[#155DFC]/5 group-hover:border-[#155DFC]/40 group-hover:shadow-md transition-all duration-500">
                          <Plus size={22} className="text-[#98A2B3] group-hover:text-[#155DFC] transition-all duration-300 group-hover:rotate-90" />

                          {/* Professional Horizontal Tooltip - Now centered vertically */}
                          <div className="absolute top-1/2 right-[125%] -translate-y-1/2 z-50 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 translate-x-2 group-hover:translate-x-0 whitespace-nowrap px-3 py-1.5 bg-[#1F2937] text-white text-[12px] font-medium rounded-lg shadow-xl shadow-[#1F2937]/20 border border-white/10">
                            Add Column
                            {/* Arrow pointer toward button */}
                            <div className="absolute top-1/2 left-full -translate-y-1/2 border-[6px] border-transparent border-l-[#1F2937]" />
                          </div>
                        </div>
                      </button>
                    ) : (
                      <div className="flex flex-col w-[300px] bg-white rounded-2xl border-2 border-[#155DFC] p-4 shadow-xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-2">
                          <input
                            id="new-column-input"
                            type="text"
                            placeholder="Column name..."
                            value={newColumnName}
                            onChange={(e) => setNewColumnName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newColumnName.trim()) {
                                finalizeAddColumn(newColumnName.trim(), toColumnStatus(newColumnName.trim()));
                                setNewColumnName('');
                                setIsAddingColumn(false);
                              } else if (e.key === 'Escape') {
                                setIsAddingColumn(false);
                                setNewColumnName('');
                              }
                            }}
                            className="flex-1 px-3 py-2 bg-[#F9FAFB] border border-[#EAECF0] rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#155DFC]/20 focus:border-[#155DFC]"
                          />
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                if (newColumnName.trim()) {
                                  finalizeAddColumn(newColumnName.trim(), toColumnStatus(newColumnName.trim()));
                                  setNewColumnName('');
                                  setIsAddingColumn(false);
                                }
                              }}
                              className="p-2 bg-[#155DFC] text-white rounded-lg hover:bg-[#1149C9] transition-colors shadow-sm"
                              title="Add Column"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={() => setIsAddingColumn(false)}
                              className="p-2 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors"
                              title="Cancel"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                        <p className="mt-2 text-[10px] text-[#475467] font-medium italic">Type name & click checkmark</p>
                      </div>
                    )}
                  </div>
                </div>
              </SprintDragDropProvider>
            </div>

            <CreateColumnModal
              isOpen={isColumnModalOpen}
              onClose={() => setIsColumnModalOpen(false)}
              onCreateColumn={finalizeAddColumn}
              loading={isCreatingColumn}
            />

            {selectedTaskId !== null && (
              <TaskCardModal
                taskId={selectedTaskId}
                onClose={(_wasModified) => setSelectedTaskId(null)}
              />
            )}
          </>
        )}
      </div>
    );
  }
