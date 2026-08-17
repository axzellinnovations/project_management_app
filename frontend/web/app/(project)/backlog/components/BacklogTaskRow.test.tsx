import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BacklogTaskRow from './BacklogTaskRow';
import type { Task } from '../../kanban/types';
import type { TeamMemberOption } from '../../kanban/api';

const mockTask: Task = {
  id: 101,
  title: 'Test Backlog Task',
  status: 'TODO',
  priority: 'HIGH',
  storyPoint: 3,
  dueDate: '2026-09-01',
  assigneeId: 1,
  assigneeName: 'Alice Johnson',
  assigneePhotoUrl: 'https://example.com/alice.jpg',
  assignees: [
    { id: 1, userId: 1, name: 'Alice Johnson', photoUrl: 'https://example.com/alice.jpg' },
    { id: 2, userId: 2, name: 'Bob Smith', photoUrl: 'https://example.com/bob.jpg' },
  ],
  labels: [{ id: 10, name: 'Frontend', color: '#6366F1' }],
};

const mockTeamMembers: TeamMemberOption[] = [
  { id: 1, userId: 1, memberId: 1, name: 'Alice Johnson', photoUrl: 'https://example.com/alice.jpg' },
  { id: 2, userId: 2, memberId: 2, name: 'Bob Smith', photoUrl: 'https://example.com/bob.jpg' },
  { id: 3, userId: 3, memberId: 3, name: 'Charlie Brown', photoUrl: null },
];

describe('BacklogTaskRow', () => {
  it('renders task title and multiple assignee avatars', () => {
    render(
      <BacklogTaskRow
        task={mockTask}
        onDelete={jest.fn()}
        onClick={jest.fn()}
        onStatusChange={jest.fn()}
        onOpenModal={jest.fn()}
        teamMembers={mockTeamMembers}
      />
    );

    expect(screen.getByText('Test Backlog Task')).toBeInTheDocument();
    expect(screen.getByText('#101')).toBeInTheDocument();
    // Verify both assignees are in the title tooltip
    const assigneeBtn = screen.getByTitle('Alice Johnson, Bob Smith');
    expect(assigneeBtn).toBeInTheDocument();
  });

  it('renders +N counter when more than 3 assignees are assigned', () => {
    const taskWithFourAssignees: Task = {
      ...mockTask,
      assignees: [
        { id: 1, userId: 1, name: 'Alice' },
        { id: 2, userId: 2, name: 'Bob' },
        { id: 3, userId: 3, name: 'Charlie' },
        { id: 4, userId: 4, name: 'David' },
      ],
    };

    render(
      <BacklogTaskRow
        task={taskWithFourAssignees}
        onDelete={jest.fn()}
        onClick={jest.fn()}
        onStatusChange={jest.fn()}
        onOpenModal={jest.fn()}
        teamMembers={mockTeamMembers}
      />
    );

    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('opens assignee dropdown and calls onAssignMultiple when a member is toggled', () => {
    const onAssignMultiple = jest.fn();

    render(
      <BacklogTaskRow
        task={mockTask}
        onDelete={jest.fn()}
        onClick={jest.fn()}
        onStatusChange={jest.fn()}
        onOpenModal={jest.fn()}
        onAssignMultiple={onAssignMultiple}
        teamMembers={mockTeamMembers}
      />
    );

    const assigneeBtn = screen.getByTitle('Alice Johnson, Bob Smith');
    fireEvent.click(assigneeBtn);

    // Popover is open
    expect(screen.getByText('Assignees')).toBeInTheDocument();
    expect(screen.getByText('Charlie Brown')).toBeInTheDocument();

    // Toggle Charlie Brown (userId: 3)
    fireEvent.click(screen.getByText('Charlie Brown'));
    expect(onAssignMultiple).toHaveBeenCalledWith(101, [1, 2, 3]);
  });

  it('calls onAssignMultiple with empty array when Unassigned is clicked in single mode', () => {
    const onAssignMultiple = jest.fn();

    render(
      <BacklogTaskRow
        task={mockTask}
        onDelete={jest.fn()}
        onClick={jest.fn()}
        onStatusChange={jest.fn()}
        onOpenModal={jest.fn()}
        onAssignMultiple={onAssignMultiple}
        teamMembers={mockTeamMembers}
      />
    );

    const assigneeBtn = screen.getByTitle('Alice Johnson, Bob Smith');
    fireEvent.click(assigneeBtn);

    // Click Single mode
    fireEvent.click(screen.getByText('Single'));

    // Click Unassigned
    fireEvent.click(screen.getByText('Unassigned'));
    expect(onAssignMultiple).toHaveBeenCalledWith(101, []);
  });
});
