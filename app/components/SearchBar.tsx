'use client';
import { useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import type { Message, DMMessage } from './types';

interface SearchBarProps {
  chatContext: {
    type: 'channel' | 'dm';
    channel?: { id: number };
    dmChannel?: { id: number };
  };
  onResultsFound: (results: (Message | DMMessage)[]) => void;
}

interface RAGSearchResult {
  pageContent: string;
  metadata: {
    messageId: number;
    userId: string;
    username: string;
    channelId: number;
    timestamp: string;
  };
}

export default function SearchBar({ chatContext, onResultsFound }: SearchBarProps) {
  const supabase = useSupabaseClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setIsSearching(true);

    try {
      // Handle AI search
      if (searchTerm.trim().startsWith('/ai ')) {
        const query = searchTerm.slice(4).trim();
        if (!query) {
          console.error('Please provide a query after /ai');
          return;
        }

        if (chatContext.type === 'channel' && chatContext.channel) {
          // Get messages for indexing
          const { data: messages } = await supabase
            .from('messages')
            .select('*')
            .eq('channel_id', chatContext.channel.id);

          if (messages) {
            // First index the messages
            const indexResponse = await fetch('/api/ai', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                action: 'index',
                messages
              }),
            });

            if (!indexResponse.ok) {
              throw new Error('Failed to index messages');
            }

            // Then perform the search
            const searchResponse = await fetch('/api/ai', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                action: 'search',
                query
              }),
            });

            if (!searchResponse.ok) {
              throw new Error('Search request failed');
            }

            const { results } = await searchResponse.json();
            
            // Convert RAG results to Message format
            const formattedResults: Message[] = results.map((result: RAGSearchResult) => ({
              id: result.metadata.messageId,
              content: result.pageContent,
              user_id: result.metadata.userId,
              username: result.metadata.username,
              channel_id: result.metadata.channelId,
              created_at: result.metadata.timestamp,
              reactions: []
            }));

            onResultsFound(formattedResults);
          }
        }
        setSearchTerm('');
        setIsSearching(false);
        return;
      }

      // Regular search
      let query;
      if (chatContext.type === 'channel' && chatContext.channel) {
        query = supabase
          .from('messages')
          .select('*')
          .eq('channel_id', chatContext.channel.id)
          .ilike('content', `%${searchTerm}%`)
          .order('created_at', { ascending: false });
      } else if (chatContext.type === 'dm' && chatContext.dmChannel) {
        query = supabase
          .from('dm_messages')
          .select('*')
          .eq('dm_channel_id', chatContext.dmChannel.id)
          .ilike('content', `%${searchTerm}%`)
          .order('created_at', { ascending: false });
      }

      if (!query) return;
      const { data, error } = await query;
      if (error) throw error;
      
      onResultsFound(data || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
      setSearchTerm('');
    }
  };

  return (
    <div className="relative p-2">
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        placeholder="Search messages or use /ai for AI search..."
        className="w-full rounded-lg border bg-transparent px-4 py-2 pr-10 focus:border-blue-500 focus:outline-none"
      />
      <button
        onClick={handleSearch}
        disabled={isSearching}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
      >
        {isSearching ? '...' : '🔍'}
      </button>
    </div>
  );
}