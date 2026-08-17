import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProjectFigmaPage from './page';
import { fetchProjectDetails } from '@/services/projects-service';

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: '42' }),
}));

jest.mock('@/services/projects-service', () => ({
  fetchProjectDetails: jest.fn(),
}));

const mockedFetchProjectDetails = fetchProjectDetails as jest.MockedFunction<typeof fetchProjectDetails>;

describe('ProjectFigmaPage', () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockedFetchProjectDetails.mockReset();
  });

  it('fetches the saved project Figma URL and embeds it on refreshable route load', async () => {
    const figmaUrl = 'https://www.figma.com/file/abc123/My-Design?node-id=1%3A2';
    mockedFetchProjectDetails.mockResolvedValue({
      id: 42,
      name: 'Atlas',
      figmaUrl,
    });

    render(<ProjectFigmaPage />);

    await waitFor(() => expect(mockedFetchProjectDetails).toHaveBeenCalledWith('42'));
    const frame = await screen.findByTitle('Atlas Figma design');

    expect(frame).toHaveAttribute(
      'src',
      `https://www.figma.com/embed?embed_host=planora&url=${encodeURIComponent(figmaUrl)}`,
    );
    expect(screen.getByRole('link', { name: /open in figma/i })).toHaveAttribute('href', figmaUrl);

    expect(await screen.findByText(/loading figma preview/i)).toBeInTheDocument();
    fireEvent.load(frame);
    expect(screen.queryByText(/loading figma preview/i)).not.toBeInTheDocument();
  });

  it('shows an explicit open button when the saved URL cannot be embedded', async () => {
    const figmaUrl = 'https://example.com/design';
    mockedFetchProjectDetails.mockResolvedValue({
      id: 42,
      name: 'Atlas',
      figmaUrl,
    });

    render(<ProjectFigmaPage />);

    expect(await screen.findByText(/cannot be displayed here/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /open in figma/i }).at(-1)).toHaveAttribute('href', figmaUrl);
  });

  it('falls back to a Planora message when the iframe does not load', async () => {
    jest.useFakeTimers();
    const figmaUrl = 'https://www.figma.com/file/abc123/My-Design?node-id=1%3A2';
    mockedFetchProjectDetails.mockResolvedValue({
      id: 42,
      name: 'Atlas',
      figmaUrl,
    });

    render(<ProjectFigmaPage />);

    expect(await screen.findByText(/loading figma preview/i)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(8000);
    });

    expect(await screen.findByText(/cannot be displayed here/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /open in figma/i }).at(-1)).toHaveAttribute('href', figmaUrl);
  });
});
