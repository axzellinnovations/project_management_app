    'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { DragEndEvent } from '@dnd-kit/core';
import { useSearchParams } from 'next/navigation';
import { Sprintboard, SprintboardTask } from './types';
import { fetchSprintboardBySprintId, moveTaskToColumn, fetchSprintsByProject, completeSprint, addColumn } from './api';
import SprintBoardHeader from './components/SprintBoardHeader';
import SprintColumn from './components/SprintColumn';
import SprintDragDropProvider from './components/SprintDragDropProvider';
import CreateTaskModal from './components/CreateTaskModal';
import CreateColumnModal from './components/CreateColumnModal';
import { Loader, AlertCircle, CheckCircle2, Plus, Check, X } from 'lucide-react';
import axios from '@/lib/axios';
import { AxiosError } from 'axios';
import { toast } from '@/components/ui';
import TaskCardModal from '@/app/taskcard/TaskCardModal';

interface SprintSummary {
  id: number;
  status: string;
  sprintName?: string;
}

export default function SprintBoardPage() {
  const searchParams = useSearchParams();
  const projectIdStr = searchParams.get('projectId');
  
  const [sprintboard, setSprintboard] = useState<Sprintboard | null>(null);
  const [activeSprint, setActiveSprint] = useState<SprintSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [isAgile, setIsAgile] = useState(true);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [selectedColumn, setSelectedColumn] = useState('TODO');
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingColumn, setIsCreatingColumn] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  const fetchActiveSprintAndBoard = useCallback(async () => {
    if (!projectIdStr) return;
    
    setLoading(true);
    setError(null);
    try {
      const projectId = parseInt(projectIdStr);
      
      // 1. Check if project is AGILE
      const projectRes = await axios.get(`/api/projects/${projectId}`);
      const project = projectRes.data;
      
      if (project.type !== 'AGILE') {
        setIsAgile(false);
        setLoading(false);
        return;
      }
      
      // 2. Fetch all sprints to find the active one
      const sprints = await fetchSprintsByProject(projectId) as SprintSummary[];
      const active = sprints.find((s) => s.status === 'ACTIVE');
      
      if (!active) {
        setLoading(false);
        return;
      }
      
      setActiveSprint(active);
      
      // 3. Fetch sprint board for the active sprint
      const board = await fetchSprintboardBySprintId(active.id);
      setSprintboard(board);
    } catch (err: unknown) {
      console.error('Failed to load sprint board:', err);
      const axiosErr = err as AxiosError<{ message?: string }>;
      setError(axiosErr?.response?.data?.message || 'Failed to load sprint board. Please make sure the sprint has been started.');
    } finally {
      setLoading(false);
    }
  }, [projectIdStr]);

  useEffect(() => {
    fetchActiveSprintAndBoard();
  }, [fetchActiveSprintAndBoard]);

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
    
    // Find the task and current column
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

    setSprintboard({ ...sprintboard, columns: newColumns });

    try {
      await moveTaskToColumn(taskId, sprintboard.id, newStatus);
    } catch (err) {
      console.error('Failed to move task:', err);
      // Revert if failed
      fetchActiveSprintAndBoard();
    }
  };

  const handleCreateTask = async (taskData: Record<string, unknown>) => {
    if (!projectIdStr) return;
    setIsCreating(true);
    try {
        await axios.post('/api/tasks', taskData);
        setSuccessMsg('Task created!');
        setTimeout(() => setSuccessMsg(''), 2000);
        fetchActiveSprintAndBoard();
    } catch (err: unknown) {
        console.error('Failed to create task:', err);
        const axiosErr = err as AxiosError<{ message?: string }>;
        toast(axiosErr?.response?.data?.message || 'Failed to create task.', 'error');
    } finally {
        setIsCreating(false);
    }
  };

  const handleCompleteSprint = async () => {
    if (!activeSprint || !confirm('Are you sure you want to complete this sprint? All tasks will be finalized.')) return;
    
    setIsUpdating(true);
    try {
      await completeSprint(activeSprint.id, activeSprint as unknown as Record<string, unknown>);
      setSuccessMsg('Sprint completed successfully!');
      setTimeout(() => {
        setSuccessMsg('');
        fetchActiveSprintAndBoard(); // Refresh state
      }, 2000);
    } catch (err) {
      console.error('Failed to complete sprint:', err);
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
      fetchActiveSprintAndBoard();
    } catch (err: unknown) {
      console.error('Failed to add column:', err);
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

  if (!isAgile) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center p-10 bg-white rounded-3xl shadow-sm border border-[#EAECF0] max-w-lg">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
             <AlertCircle className="w-8 h-8 text-[#155DFC]" />
          </div>
          <h2 className="text-2xl font-bold text-[#101828]">Kanban Projects don&apos;t have Sprints</h2>
          <p className="text-[#475467] mt-3">The Sprint Board is exclusive to <span className="font-bold text-[#155DFC]">Agile</span> projects. Please switch to the regular Kanban Board for this project.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
        
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
                onClick={() => fetchActiveSprintAndBoard()}
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
              <p className="text-[#475467] text-sm mt-2">Start a sprint in the backlog to see progress here.</p>
            </div>
          </div>
        ) : (
          <>
            <SprintBoardHeader 
              sprintName={sprintboard.sprintName}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onCompleteSprint={handleCompleteSprint}
              isLoading={isUpdating}
            />
            
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
                      onCreateTask={(status) => {
                          setSelectedColumn(status);
                          setIsCreateModalOpen(true);
                      }}
                      onOpenTask={(taskId: number) => setSelectedTaskId(taskId)}
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
                                  finalizeAddColumn(newColumnName.trim(), 'IN_PROGRESS');
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
                                            finalizeAddColumn(newColumnName.trim(), 'IN_PROGRESS');
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

            {activeSprint && (
                <CreateTaskModal 
                    isOpen={isCreateModalOpen} 
                    onClose={() => setIsCreateModalOpen(false)} 
                    onCreateTask={handleCreateTask} 
                    columnStatus={selectedColumn} 
                    projectId={parseInt(projectIdStr)} 
                    sprintId={activeSprint.id}
                    loading={isCreating}
                />
            )}

            <CreateColumnModal 
                isOpen={isColumnModalOpen} 
                onClose={() => setIsColumnModalOpen(false)} 
                onCreateColumn={finalizeAddColumn} 
                loading={isCreatingColumn}
            />

            {selectedTaskId !== null && (
              <TaskCardModal
                taskId={selectedTaskId}
                onClose={() => { setSelectedTaskId(null); fetchActiveSprintAndBoard(); }}
              />
            )}
          </>
        )}
    </div>
  );
}
