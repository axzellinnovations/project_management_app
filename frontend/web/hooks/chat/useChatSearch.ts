import { useState, useCallback } from 'react';
import * as chatApi from '@/services/chat-service';
import type { ChatSearchResult } from '@/app/(project)/project/[id]/chat/components/chat';

export function useChatSearch(projectId: string) {
  const [searchResults, setSearchResults] = useState<ChatSearchResult[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);

  const searchMessages = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) {
        setSearchResults([]);
        return;
      }

      setIsSearchLoading(true);
      try {
        const results = await chatApi.searchChatMessages(projectId, trimmed);
        setSearchResults(results);
      } catch (err) {
        console.error('Search failed', err);
        setSearchResults([]);
      } finally {
        setIsSearchLoading(false);
      }
    },
    [projectId],
  );

  return { searchResults, isSearchLoading, searchMessages };
}

