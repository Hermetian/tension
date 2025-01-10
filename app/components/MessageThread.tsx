'use client';
import { useState } from 'react';
import { FileAttachment, Message } from './types';

interface MessageThreadProps {
  message: Message;
  replies: Message[];
  currentUserId: string;
  onReply: (messageId: number) => void;
  renderFileAttachment: (file: FileAttachment) => React.ReactNode;
}

export function MessageThread({ 
    message, 
    replies, 
    currentUserId, 
    onReply,
    renderFileAttachment 
  }: MessageThreadProps) {
    // Track hover state for each message individually
    const [hoveredMessageId, setHoveredMessageId] = useState<number | null>(null);
  
    // Helper function to render a single message
    const renderMessage = (msg: Message, isReply: boolean = false) => (
      <div
        key={msg.id}
        className={`flex ${msg.user_id === currentUserId ? 'justify-end' : 'justify-start'}`}
        onMouseEnter={() => setHoveredMessageId(msg.id)}
        onMouseLeave={() => setHoveredMessageId(null)}
      >
        <div className="relative">
          {/* Reply button - show on hover for ALL messages, not just our own */}
          {hoveredMessageId === msg.id && !isReply && (
            <button
              onClick={() => onReply(msg.id)}
              className={`absolute ${
                // Position the reply button on the appropriate side based on message alignment
                msg.user_id === currentUserId ? '-left-8' : '-right-8'
              } top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600`}
              title="Reply to this message"
            >
              ↩️
            </button>
          )}
          
          {/* Message content */}
          <div className={`rounded-lg px-4 py-2 ${
            msg.user_id === currentUserId 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-100 dark:bg-gray-800'
          }`}>
            <p className="text-sm font-medium">{msg.username}</p>
            <p>{msg.content}</p>
            {msg.file && renderFileAttachment(msg.file)}
          </div>
        </div>
      </div>
    );
  
    return (
      <div className="space-y-2">
        {/* Original message */}
        {renderMessage(message)}
        
        {/* Replies - indented */}
        {replies.length > 0 && (
          <div className="ml-8 space-y-2 border-l-2 border-gray-200 pl-4">
            {replies.map(reply => renderMessage(reply, true))}
          </div>
        )}
      </div>
    );
  }