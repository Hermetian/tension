'use client';
import { useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import type { Message, DMMessage } from './types';
import { indexMessages, queryMessages } from '../utils/ragUtils';

interface SearchBarProps {
  chatContext: {
    type: 'channel' | 'dm';
    channel?: { id: number };
    dmChannel?: { id: number };
  };
  onResultsFound: (results: (Message | DMMessage)[]) => void;
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
          const { data: messages } = await supabase
            .from('messages')
            .select('*')
            .eq('channel_id', chatContext.channel.id);

          if (messages) {
            await indexMessages(messages);
            const results = await queryMessages(query);
            
            // Convert RAG results to Message format for display
            const searchResults: Message[] = results.map((result) => {
              const metadata = result.metadata as { 
                messageId: number,
                userId: string,
                username: string,
                channelId: number,
                timestamp: string 
              };
              
              return {
                id: metadata.messageId,
                content: result.pageContent,
                user_id: metadata.userId,
                username: metadata.username,
                channel_id: metadata.channelId,
                created_at: metadata.timestamp,
                reactions: [],
              } as Message;
            });

            onResultsFound(searchResults);
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
        {isSearching ? '...' : '��'}
      </button>
    </div>
  );
}