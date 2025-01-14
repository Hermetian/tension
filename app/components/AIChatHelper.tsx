'use client';
import { useState } from 'react';
import { queryMessages } from '../utils/ragUtils';

interface AIChatHelperProps {
  currentChannel?: { id: number; name: string };
}

export default function AIChatHelper({ currentChannel }: AIChatHelperProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const handleQuery = async () => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    try {
      const searchResults = await queryMessages(query);
      setResults(searchResults);
    } catch (error) {
      console.error('Error querying messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border-t p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold mb-2">AI Chat Helper</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about previous messages..."
            className="flex-1 rounded-lg border bg-transparent px-4 py-2 focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={handleQuery}
            disabled={isLoading}
            className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? '...' : 'Ask'}
          </button>
        </div>
      </div>
      
      {results.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Related Messages:</h4>
          {results.map((result, index) => (
            <div key={index} className="rounded-lg bg-gray-100 p-2 dark:bg-gray-800">
              <p className="text-sm">{result.pageContent}</p>
              <p className="text-xs text-gray-500 mt-1">
                By {result.metadata.username} at {new Date(result.metadata.timestamp).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}