import { render, screen } from '@testing-library/react';
import VelocityChart from './VelocityChart';
import type { SprintItem } from '@/types';

// ResizeObserver is not available in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const makeSprintItem = (id: number, name: string, tasks: SprintItem['tasks'] = []): SprintItem => ({
  id,
  name,
  status: 'COMPLETED',
  startDate: '2024-01-01',
  endDate: '2024-01-14',
  goal: '',
  tasks,
});

describe('VelocityChart', () => {
  it('renders without crashing with empty sprints', () => {
    const { container } = render(<VelocityChart sprints={[]} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders sprint name in chart', () => {
    const sprintItem = makeSprintItem(1, 'Sprint Alpha');
    const { container } = render(<VelocityChart sprints={[sprintItem]} />);
    expect(container.innerHTML).toContain('Sprint Alpha');
  });

  it('renders velocity label', () => {
    render(<VelocityChart sprints={[makeSprintItem(1, 'Sprint 1')]} />);
    expect(screen.getByText(/velocity/i)).toBeInTheDocument();
  });
});
