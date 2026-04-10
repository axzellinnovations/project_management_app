import { act, renderHook, waitFor } from '@testing-library/react';
import axiosInstance from '../../../../lib/axios';
import { usePages } from './usePages';

jest.mock('../../../../lib/axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedAxios = axiosInstance as jest.Mocked<typeof axiosInstance>;

describe('usePages hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads pages and filters by search and tab', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: [
        { id: 1, title: 'Release Notes' },
        { id: 2, title: 'Architecture' },
      ],
    });

    const { result } = renderHook(() => usePages(7));

    await waitFor(() => {
      expect(result.current.pages).toHaveLength(2);
    });

    act(() => {
      result.current.toggleStar(2);
      result.current.setActiveTab('starred');
      result.current.setSearchQuery('arch');
    });

    expect(result.current.filteredPages).toHaveLength(1);
    expect(result.current.filteredPages[0].title).toBe('Architecture');
  });

  it('create/update/delete page updates local state', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: [] });
    mockedAxios.post.mockResolvedValueOnce({
      data: { id: 11, title: 'Spec', content: 'v1', updatedAt: '2026-03-01T12:00:00' },
    });
    mockedAxios.put.mockResolvedValueOnce({
      data: { id: 11, title: 'Spec v2', content: 'v2', updatedAt: '2026-03-02T12:00:00' },
    });
    mockedAxios.delete.mockResolvedValueOnce({});

    const { result } = renderHook(() => usePages(5));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.createPage('Spec', 'v1');
    });
    expect(result.current.pages).toHaveLength(1);

    await act(async () => {
      await result.current.updatePage(11, 'Spec v2', 'v2');
    });
    expect(result.current.pages[0].title).toBe('Spec v2');

    await act(async () => {
      await result.current.deletePage(11);
    });
    expect(result.current.pages).toHaveLength(0);
  });

  it('sets a friendly error when project id is missing', async () => {
    const { result } = renderHook(() => usePages(null));

    await waitFor(() => {
      expect(result.current.error).toBe('Project ID not found');
    });
  });
});
