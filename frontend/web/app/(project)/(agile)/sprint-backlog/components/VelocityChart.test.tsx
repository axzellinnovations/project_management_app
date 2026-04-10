import { render, screen } from '@testing-library/react';
import VelocityChart from './VelocityChart';
import type { SprintVelocityPoint } from './VelocityChart';

// ResizeObserver is not available in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const makeVelocityPoint = (id: number, name: string, committed = 5, completed = 4): SprintVelocityPoint => ({
  sprintId: id,
  sprintName: name,
  committedPoints: committed,
  completedPoints: completed,
});

describe('VelocityChart', () => {
  it('renders without crashing with empty sprints', () => {
    const { container } = render(<VelocityChart sprints={[]} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders sprint name in chart', () => {
    const { container } = render(<VelocityChart sprints={[makeVelocityPoint(1, 'Sprint Alpha')]} />);
    expect(container.innerHTML).toContain('Sprint Alpha');
  });

  it('renders velocity label', () => {
    render(<VelocityChart sprints={[makeVelocityPoint(1, 'Sprint 1')]} />);
    expect(screen.getByText(/velocity/i)).toBeInTheDocument();
  });
});
