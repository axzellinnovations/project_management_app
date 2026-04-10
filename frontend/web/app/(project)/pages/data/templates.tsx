import React from 'react';
import {
    FileText, Server, Zap, Bug, Target, BookOpen, Clock, Activity, MessageSquare,
} from 'lucide-react';
import { Template } from '../components/types';

export const predefinedTemplates: Template[] = [
    {
        id: 'blank',
        name: 'Blank Page',
        description: 'Start from scratch with a completely blank canvas.',
        icon: <FileText size={24} className="text-gray-400" />,
        content: '',
    },
    {
        id: 'meeting-notes',
        name: 'Meeting Notes',
        description: 'Structure for agenda, attendees, and action items.',
        icon: <MessageSquare size={24} className="text-blue-500" />,
        content: `
      <h1>Meeting Notes: [Topic]</h1>
      <p><strong>Date:</strong> YYYY-MM-DD | <strong>Attendees:</strong> @Person</p>
      <h2>Agenda</h2>
      <ul>
        <li><p>Topic 1</p></li>
        <li><p>Topic 2</p></li>
      </ul>
      <h2>Discussion</h2>
      <p>Key points discussed during the meeting...</p>
      <h2>Action Items</h2>
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="false">Task 1 (@Owner, Due Date)</li>
        <li data-type="taskItem" data-checked="false">Task 2 (@Owner, Due Date)</li>
      </ul>
    `,
    },
    {
        id: 'project-plan',
        name: 'Project Plan',
        description: 'High-level timeline, objectives, and resources.',
        icon: <Target size={24} className="text-indigo-500" />,
        content: `
      <h1>Project Plan: [Project Name]</h1>
      <h2>1. Executive Summary</h2>
      <p>Brief overview of what the project aims to achieve.</p>
      <h2>2. Objectives & Key Results (OKRs)</h2>
      <ul><li><p><strong>Objective 1:</strong> Description</p></li></ul>
      <h2>3. Timeline & Deliverables</h2>
      <table>
        <tbody>
          <tr><th>Phase</th><th>Deliverable</th><th>Deadline</th></tr>
          <tr><td>Phase 1</td><td>Requirements</td><td>YYYY-MM-DD</td></tr>
        </tbody>
      </table>
      <h2>4. Resources & Budget</h2>
      <p>Detail team members, tools, and budget allocations.</p>
    `,
    },
    {
        id: 'prd',
        name: 'Product Requirements',
        description: 'Goals, User Stories, and Scope (PRD).',
        icon: <Server size={24} className="text-purple-500" />,
        content: `
      <h1>Product Requirements Document (PRD)</h1>
      <h2>1. Overview & Goals</h2>
      <p>What are we building and why?</p>
      <h2>2. Target Audience</h2>
      <p>Who is this for?</p>
      <h2>3. User Stories</h2>
      <ul>
        <li><p>As a [user type], I want to [action] so that [benefit].</p></li>
      </ul>
      <h2>4. Out of Scope</h2>
      <p>What are we explicitly NOT doing?</p>
    `,
    },
    {
        id: 'retrospective',
        name: 'Retrospective',
        description: 'General reflection on recent team performance.',
        icon: <Activity size={24} className="text-amber-500" />,
        content: `
      <h1>Team Retrospective</h1>
      <h2>What went well?</h2>
      <ul><li><p></p></li></ul>
      <h2>What didn't go well?</h2>
      <ul><li><p></p></li></ul>
      <h2>What can we improve?</h2>
      <ul><li><p></p></li></ul>
    `,
    },
    {
        id: 'sprint-retro',
        name: 'Sprint Retrospective',
        description: 'Agile reflection focused specifically on the last sprint.',
        icon: <Clock size={24} className="text-orange-500" />,
        content: `
      <h1>Sprint Retrospective: [Sprint Name/Number]</h1>
      <h2>Sprint Goal Review</h2>
      <p>Did we meet our sprint goal? Yes/No, because...</p>
      <h2>Start / Stop / Continue</h2>
      <table>
        <tbody>
          <tr>
            <th>Start Doing</th>
            <th>Stop Doing</th>
            <th>Continue Doing</th>
          </tr>
          <tr>
            <td><p></p></td>
            <td><p></p></td>
            <td><p></p></td>
          </tr>
        </tbody>
      </table>
      <h2>Action Items for Next Sprint</h2>
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="false">Action Item 1</li>
      </ul>
    `,
    },
    {
        id: 'knowledge-base',
        name: 'Knowledge Base Article',
        description: 'Tutorials, guides, and step-by-step instructions.',
        icon: <BookOpen size={24} className="text-green-500" />,
        content: `
      <h1>How to [Action/Topic]</h1>
      <h2>Overview</h2>
      <p>Brief description of what this article covers and who it is for.</p>
      <h2>Prerequisites</h2>
      <ul><li><p>What do you need before starting?</p></li></ul>
      <h2>Step-by-Step Instructions</h2>
      <ol>
        <li><p><strong>Step 1:</strong> Do the first thing.</p></li>
        <li><p><strong>Step 2:</strong> Do the second thing.</p></li>
      </ol>
      <h2>Troubleshooting</h2>
      <p>Common issues and how to fix them.</p>
    `,
    },
    {
        id: 'bug-report',
        name: 'Bug Report',
        description: 'Standardized format for reproducing and tracking bugs.',
        icon: <Bug size={24} className="text-red-500" />,
        content: `
      <h1>Bug Report: [Short Description]</h1>
      <h2>1. Description</h2>
      <p>A clear and concise description of what the bug is.</p>
      <h2>2. Steps to Reproduce</h2>
      <ol>
        <li><p>Go to '...'</p></li>
        <li><p>Click on '....'</p></li>
        <li><p>Scroll down to '....'</p></li>
        <li><p>See error</p></li>
      </ol>
      <h2>3. Expected vs Actual Behavior</h2>
      <p><strong>Expected:</strong> What should happen.</p>
      <p><strong>Actual:</strong> What actually happens.</p>
      <h2>4. Environment</h2>
      <ul>
        <li><p>OS: [e.g. iOS, Windows]</p></li>
        <li><p>Browser: [e.g. Chrome, Safari]</p></li>
        <li><p>Version: [e.g. 1.0.4]</p></li>
      </ul>
    `,
    },
    {
        id: 'release-notes',
        name: 'Release Notes',
        description: 'Communicate what is new, improved, and fixed.',
        icon: <Zap size={24} className="text-yellow-500" />,
        content: `
      <h1>Release Notes: Version [X.Y.Z]</h1>
      <p><strong>Release Date:</strong> YYYY-MM-DD</p>
      <h2>🎉 New Features</h2>
      <ul><li><p>Feature 1 description</p></li></ul>
      <h2>🚀 Improvements</h2>
      <ul><li><p>Improvement 1 description</p></li></ul>
      <h2>🐛 Bug Fixes</h2>
      <ul><li><p>Fixed issue where [X] happened</p></li></ul>
    `,
    },
];
