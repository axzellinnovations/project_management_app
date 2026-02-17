"use client";
import React from 'react';
import TaskHeader from './TaskHeader';
import TaskMainContent from './TaskMainContent';
import TaskSidebar from './TaskSidebar';

export default function TaskPage() {
  
  // MOCK DATA: Simulating the response from your Java Backend
  const taskData = {
    id: "TASK-124",
    title: "Implement Secure Fund Transfer API",
    description: "Create the backend logic for transferring funds between accounts. Ensure transactional integrity and ACID compliance. Need to handle edge cases where user balance is insufficient.",
    project: "Suthankan Cafe Website",
    status: "In Progress",
    priority: "High",
    storyPoint: 5,
    reporter: "Sarah Smith",
    assignee: "John Doe",
    sprint: "BANK Sprint 1",
    labels: ["Backend", "API", "Security", "Java"],
    created: "Dec 26, 2025 10:30 AM",
    updated: "Dec 28, 2025 02:15 PM",
    dueDate: "Jan 10, 2026",
    subtasks: [
      { id: "TASK-125", title: "Validate User Balance", status: "Done" },
      { id: "TASK-126", title: "Create Transaction Record", status: "To Do" },
      { id: "TASK-127", title: "Notify User via Email", status: "To Do" }
    ],
    dependencies: [
      { id: "TASK-101", title: "Database Schema Design", relation: "is blocked by" }
    ]
  };

  const handleClose = () => {
    console.log("Modal closed");
    // In a real app, you'd use router.back() or toggle a state
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      {/* Container Wrapper:
        In your actual app, this might be a Modal Overlay (fixed inset-0 bg-black/50)
      */}
      <div className="w-full max-w-6xl bg-white border border-gray-200 h-[90vh] shadow-2xl flex flex-col font-sans rounded-lg overflow-hidden">
        
        {/* 1. Header Component */}
        <TaskHeader 
          project={taskData.project} 
          taskId={taskData.id} 
          onClose={handleClose} 
        />

        <div className="flex flex-1 overflow-hidden">
          
          {/* 2. Main Content Component (Left Side) */}
          <TaskMainContent 
              title={taskData.title}
              description={taskData.description}
              subtasks={taskData.subtasks}
              dependencies={taskData.dependencies}
          />

          {/* 3. Sidebar Component (Right Side) */}
          <TaskSidebar 
              status={taskData.status}
              assignee={taskData.assignee}
              reporter={taskData.reporter}
              labels={taskData.labels}
              priority={taskData.priority}
              sprint={taskData.sprint}
              storyPoint={taskData.storyPoint}
              dates={{
                  created: taskData.created,
                  updated: taskData.updated,
                  dueDate: taskData.dueDate
              }}
          />

        </div>
      </div>
    </div>
  );
}