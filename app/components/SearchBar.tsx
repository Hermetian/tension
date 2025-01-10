'use client';
import { useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import type { Message, DMMessage } from './types';
import type { Session } from '@supabase/auth-helpers-react';

interface SearchBarProps {
  chatContext: {
    type: 'channel' | 'dm';
    channel?: { id: number };
    dmChannel?: { id: number };
  };
  session: Session;
  onResultsFound: (results: (Message | DMMessage)[]) => void;
}

export default function SearchBar({ chatContext, session, onResultsFound }: SearchBarProps) {
  const supabase = useSupabaseClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setIsSearching(true);

    try {
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
    }
  };

  return (
    <div className="relative p-2">
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        placeholder="Search messages..."
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