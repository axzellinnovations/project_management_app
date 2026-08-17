import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import KanbanPage from './page';
import { useKanbanBoard } from './useKanbanBoard';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('projectId=12'),
}));

jest.mock('./useKanbanBoard', () => ({
  useKanbanBoard: jest.fn(),
}));

jest.mock('./components/DragDropProvider', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('./components/SortableColumn', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('./components/KanbanFilterBar', () => ({
  __esModule: true,
  default: () => <div data-testid="kanban-filter-bar" />,
}));

jest.mock('./components/CreateTaskModal', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/app/taskcard/TaskCardModal', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('./components/KanbanColumn', () => ({
  __esModule: true,
  default: ({ onDeleteTask }: { onDeleteTask: (taskId: number) => void }) => (
    <button type="button" onClick={() => onDeleteTask(1)}>
      Delete Alpha from mocked card
    </button>
  ),
}));

const mockedUseKanbanBoard = useKanbanBoard as jest.MockedFunction<typeof useKanbanBoard>;

function mockBoard(handleDeleteTask = jest.fn()) {
  mockedUseKanbanBoard.mockReturnValue({
    tasks: [{ id: 1, title: 'Alpha task with a very long delete title', status: 'TODO' }],
    filteredTasks: [],
    columns: [{ status: 'TODO', title: 'To Do', tasks: [{ id: 1, title: 'Alpha task with a very long delete title', status: 'TODO' }] }],
    columnConfigs: [{ id: 7, status: 'TODO', title: 'To Do', color: '#94A3B8', wipLimit: 0 }],
    setColumnConfigs: jest.fn(),
    loading: false,
    error: null,
    usersMap: {},
    teamMembers: [],
    labels: [],
    kanbanId: 3,
    searchTerm: '',
    setSearchTerm: jest.fn(),
    filterPriority: [],
    setFilterPriority: jest.fn(),
    filterAssignee: '',
    setFilterAssignee: jest.fn(),
    filterLabel: null,
    setFilterLabel: jest.fn(),
    filterDateRange: { startDate: null, endDate: null },
    setFilterDateRange: jest.fn(),
    clearFilters: jest.fn(),
    hasActiveFilters: false,
    isCreateModalOpen: false,
    setIsCreateModalOpen: jest.fn(),
    selectedColumnStatus: 'TODO',
    selectedTaskIdForModal: null,
    setSelectedTaskIdForModal: jest.fn(),
    updatingTaskId: null,
    completeSuccess: false,
    toastMessage: null,
    activeMobileColumn: 'TODO',
    setActiveMobileColumn: jest.fn(),
    handleDragEnd: jest.fn(),
    handleColumnDragEnd: jest.fn(),
    handleAddTask: jest.fn(),
    handleCreateTask: jest.fn(),
    handleOpenCreateModal: jest.fn(),
    handleInlineUpdate: jest.fn(),
    handleAssigneeChange: jest.fn(),
    handleDeleteTask,
    handleCompleteBoard: jest.fn(),
    handleColumnRenamed: jest.fn(),
    handleColumnSettingsChanged: jest.fn(),
    handleDeleteColumn: jest.fn(),
    handleAddColumn: jest.fn(),
    handleCreateLabel: jest.fn(),
    handleUpdateLabel: jest.fn(),
    handleDeleteLabel: jest.fn(),
    forceRefresh: jest.fn(),
  });
}

describe('KanbanPage delete confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not delete until the confirmation dialog is accepted', async () => {
    const handleDeleteTask = jest.fn().mockResolvedValue(undefined);
    mockBoard(handleDeleteTask);

    render(<KanbanPage />);

    fireEvent.click(screen.getByRole('button', { name: /delete alpha from mocked card/i }));

    expect(handleDeleteTask).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText(/alpha task with a very long delete title/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(handleDeleteTask).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /delete alpha from mocked card/i }));
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => expect(handleDeleteTask).toHaveBeenCalledWith(1));
  });
});
