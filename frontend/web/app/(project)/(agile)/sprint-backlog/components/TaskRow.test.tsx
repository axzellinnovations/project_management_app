import { render, screen, fireEvent } from '@testing-library/react';
import TaskRow, { type TaskRowTask, type TaskRowTeamMember } from './TaskRow';

const mockTask: TaskRowTask = {
  id: 1,
  taskNo: 42,
  title: 'Test task title',
  storyPoints: 3,
  selected: false,
  assigneeName: 'Alice',
  assigneePhotoUrl: null,
  status: 'TODO',
  dueDate: '2030-01-01',
  priority: 'MEDIUM',
};

const mockTeamMembers: TaskRowTeamMember[] = [
  { id: 1, user: { userId: 10, fullName: 'Alice Smith', username: 'alice', profilePicUrl: null } },
];

const noop = jest.fn();
const noopAsync = jest.fn().mockResolvedValue(undefined);

const defaultProps = {
  task: mockTask,
  teamMembers: mockTeamMembers,
  loadingMembers: false,
  canDelete: true,
  showCheckbox: true,
  onToggle: noop,
  onStatusChange: noop,
  onStoryPointsChange: noop,
  onRenameTask: noopAsync,
  onAssignTask: noopAsync,
  onDueDateChange: noop,
  onDeleteTask: noop,
  onOpenTask: noop,
};

describe('TaskRow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders task number and title', () => {
    render(<TaskRow {...defaultProps} />);
    expect(screen.getByText('#42')).toBeInTheDocument();
    expect(screen.getByText('Test task title')).toBeInTheDocument();
  });

  it('renders MEDIUM priority badge', () => {
    render(<TaskRow {...defaultProps} />);
    expect(screen.getByText('MEDIUM')).toBeInTheDocument();
  });

  it('renders story points field with correct value', () => {
    render(<TaskRow {...defaultProps} />);
    const pointsInput = screen.getByRole('spinbutton');
    expect(pointsInput).toHaveValue(3);
  });

  it('calls onOpenTask when row is clicked', () => {
    render(<TaskRow {...defaultProps} />);
    fireEvent.click(screen.getByText('Test task title'));
    expect(noop).toHaveBeenCalledWith(1);
  });

  it('calls onDeleteTask when delete button is clicked', () => {
    render(<TaskRow {...defaultProps} />);
    const deleteBtn = screen.getByTitle('Delete task');
    fireEvent.click(deleteBtn);
    expect(noop).toHaveBeenCalledWith(1);
  });

  it('calls onToggle when checkbox is clicked', () => {
    render(<TaskRow {...defaultProps} />);
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(noop).toHaveBeenCalledWith(1);
  });

  it('renders DONE task with line-through style', () => {
    render(<TaskRow {...defaultProps} task={{ ...mockTask, status: 'DONE' }} />);
    const title = screen.getByText('Test task title');
    expect(title.className).toContain('line-through');
  });

  it('does not render checkbox when showCheckbox is false', () => {
    render(<TaskRow {...defaultProps} showCheckbox={false} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('disables delete button when canDelete is false', () => {
    render(<TaskRow {...defaultProps} canDelete={false} />);
    const deleteBtn = screen.getByTitle('Viewers cannot delete tasks');
    expect(deleteBtn).toBeDisabled();
  });
});
