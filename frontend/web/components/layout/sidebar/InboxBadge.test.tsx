import { render, screen } from '@testing-library/react';
import InboxBadge from './InboxBadge';

describe('InboxBadge', () => {
  it('does not render when count is zero', () => {
    const { container } = render(<InboxBadge count={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('caps values at 99+ by default', () => {
    render(<InboxBadge count={120} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('renders inline mode for dropdown rows', () => {
    render(<InboxBadge count={7} size="inline" />);
    const badge = screen.getByText('7');
    expect(badge).toHaveClass('h-[18px]');
    expect(badge).toHaveClass('bg-cu-primary');
  });
});
