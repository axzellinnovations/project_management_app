import { renderHook, act } from '@testing-library/react';
import { useProjectContext } from '../useProjectContext';
import * as navigation from 'next/navigation';
import useSWR from 'swr';

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock('swr', () => jest.fn());

describe('useProjectContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    (navigation.useParams as jest.Mock).mockReturnValue({ id: '123' });
    (navigation.useSearchParams as jest.Mock).mockReturnValue({ get: () => '123' });
  });

  it('returns figmaUrl and projectOwnerId from SWR data', () => {
    (useSWR as jest.Mock).mockReturnValue({
      data: {
        name: 'Design Project',
        type: 'KANBAN',
        isFavorite: true,
        figmaUrl: 'https://www.figma.com/file/xyz/Design',
        ownerId: 7,
      },
      mutate: jest.fn(),
    });

    const { result } = renderHook(() => useProjectContext());

    expect(result.current.projectId).toBe('123');
    expect(result.current.figmaUrl).toBe('https://www.figma.com/file/xyz/Design');
    expect(result.current.projectOwnerId).toBe(7);
  });

  it('updates figmaUrl when planora:figma-updated event is dispatched', () => {
    const mockMutate = jest.fn();
    (useSWR as jest.Mock).mockReturnValue({
      data: {
        name: 'Design Project',
        type: 'KANBAN',
        isFavorite: false,
        figmaUrl: null,
        ownerId: 7,
      },
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useProjectContext());
    expect(result.current.figmaUrl).toBeNull();

    act(() => {
      window.dispatchEvent(
        new CustomEvent('planora:figma-updated', {
          detail: { projectId: 123, figmaUrl: 'https://www.figma.com/file/new-link' },
        })
      );
    });

    expect(result.current.figmaUrl).toBe('https://www.figma.com/file/new-link');
    expect(mockMutate).toHaveBeenCalled();
  });
});
