import { render, screen } from '@testing-library/react';
import VelocityChart, { VELOCITY_CHART_LAYOUT } from './VelocityChart';
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
  startDate: '2026-08-01',
  endDate: '2026-08-14',
  completedAt: '2026-08-14T12:00:00',
  committedPoints: committed,
  completedPoints: completed,
  commitmentCaptured: true,
});

describe('VelocityChart', () => {
  it('keeps comparison bars tightly grouped and sprint groups distinct', () => {
    expect(VELOCITY_CHART_LAYOUT).toEqual({
      barGap: 2,
      barCategoryGap: '28%',
      maxBarSize: 30,
    });
  });

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
    expect(screen.getByRole('heading', { name: /sprint velocity/i })).toBeInTheDocument();
    expect(screen.getByText('Committed (plan)')).toBeInTheDocument();
    expect(screen.getByText('Delivered (actual)')).toBeInTheDocument();
  });

  it.each([1, 6, 12])('renders a truthful comparison for %i sprint(s)', (count) => {
    const sprints = Array.from({ length: count }, (_, index) => (
      makeVelocityPoint(index + 1, `Sprint ${index + 1}`, 20, 8)
    ));
    render(<VelocityChart sprints={sprints} />);

    expect(screen.getByRole('img', { name: `Sprint velocity chart for ${count} completed sprint${count === 1 ? '' : 's'}` })).toBeInTheDocument();
    expect(screen.getAllByText('8 pts').length).toBeGreaterThan(0);
    expect(screen.getAllByText('20 pts').length).toBeGreaterThan(0);
  });

  it('preserves zero, small, equal, and widely different values', () => {
    render(<VelocityChart sprints={[
      makeVelocityPoint(1, 'Zero', 0, 0),
      makeVelocityPoint(2, 'Small', 1, 1),
      makeVelocityPoint(3, 'Under plan', 20, 5),
      makeVelocityPoint(4, 'Over plan', 10, 40),
    ]} />);

    expect(screen.getAllByText('0 pts').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1 pts').length).toBeGreaterThan(0);
    expect(screen.getAllByText('5 pts').length).toBeGreaterThan(0);
    expect(screen.getAllByText('40 pts').length).toBeGreaterThan(0);
  });

  it('renders all completed sprints in the velocity chart', () => {
    const sprints = Array.from({ length: 14 }, (_, index) => (
      makeVelocityPoint(index + 1, `Sprint ${index + 1}`, 20, 18)
    ));
    render(<VelocityChart sprints={sprints} />);

    expect(screen.getByRole('img', { name: 'Sprint velocity chart for 14 completed sprints' })).toBeInTheDocument();
  });

  it('shows an honest warning for historical sprints without a commitment baseline', () => {
    render(<VelocityChart sprints={[{ ...makeVelocityPoint(1, 'Legacy Sprint'), commitmentCaptured: false }]} />);
    expect(screen.getByText(/historical sprints without a captured commitment/i)).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });

  it('renders a retry state separately from an empty state', () => {
    const retry = jest.fn();
    render(<VelocityChart sprints={[]} status="error" error="Network unavailable" onRetry={retry} />);
    expect(screen.getByText('Velocity couldn’t be loaded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
