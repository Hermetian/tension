'use client';
import { useState} from 'react';
import { FileAttachment, Message } from './types';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

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
    const supabase = useSupabaseClient();
    const [hoveredMessageId, setHoveredMessageId] = useState<number | null>(null);
    const [showEmojiPickerFor, setShowEmojiPickerFor] = useState<number | null>(null);

    // Function to handle adding a reaction
    const addReaction = async (emoji: string, messageId: number) => {
      // Check if the user has already reacted to this message
      const { data: existingReaction, error: fetchError } = await supabase
        .from('message_reactions')
        .select('*')
        .eq('message_id', messageId)
        .eq('user_id', currentUserId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // If error is not "No rows found", log it
        console.error('Error checking existing reaction:', fetchError);
        return;
      }

      if (existingReaction) {
        // Update the existing reaction with the new emoji
        const { error: updateError } = await supabase
          .from('message_reactions')
          .update({ emoji })
          .eq('id', existingReaction.id);

        if (updateError) {
          console.error('Error updating reaction:', updateError);
        }
      } else {
        // Insert a new reaction
        const { error: insertError } = await supabase
          .from('message_reactions')
          .insert([
            {
              message_id: messageId,
              user_id: currentUserId,
              emoji: emoji,
            },
          ]);

        if (insertError) {
          console.error('Error adding reaction:', insertError);
        }
      }
    };
  
    // Helper function to render reactions
    const renderReactions = (msg: Message) => {
      if (!msg.reactions || msg.reactions.length === 0) return null;

      // Aggregate reactions
      const reactionCounts: { [emoji: string]: number } = {};
      msg.reactions.forEach((reaction) => {
        reactionCounts[reaction.emoji] = (reactionCounts[reaction.emoji] || 0) + 1;
      });

      // Get top 3 reactions
      const topReactions = Object.entries(reactionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      return (
        <div className="mt-1 flex space-x-2">
          {topReactions.map(([emoji, count]) => (
            <div
              key={emoji}
              className="flex items-center space-x-1 rounded-full bg-blue-600 px-2 py-1 text-sm text-white"
            >
              <span>{emoji}</span>
              <span>{count}</span>
            </div>
          ))}
        </div>
      );
    };
  
    // Helper function to render a single message
    const renderMessage = (msg: Message, isReply: boolean = false) => (
      <div
        key={msg.id}
        className={`flex ${msg.user_id === currentUserId ? 'justify-end' : 'justify-start'}`}
        onMouseEnter={() => setHoveredMessageId(msg.id)}
        onMouseLeave={() => setHoveredMessageId(null)}
      >
        <div className="relative">
          {/* Hover buttons */}
          {hoveredMessageId === msg.id && (
            <div
              className={`absolute ${
                msg.user_id === currentUserId ? '-left-20' : '-right-20'
              } top-1/2 -translate-y-1/2 flex space-x-2`}
            >
              {/* Reply button */}
              {!isReply && (
                <button
                  onClick={() => onReply(msg.id)}
                  className="text-gray-400 hover:text-gray-600"
                  title="Reply to this message"
                >
                  ↩️
                </button>
              )}
              {/* React button */}
              <button
                onClick={() => setShowEmojiPickerFor(msg.id)}
                className="text-gray-400 hover:text-gray-600"
                title="React to this message"
              >
                😊
              </button>
            </div>
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
            {renderReactions(msg)}
          </div>

          {/* Emoji Picker */}
          {showEmojiPickerFor === msg.id && (
            <div className="absolute z-10">
              <EmojiPicker
                onEmojiClick={async (emojiObject: EmojiClickData) => {
                  await addReaction(emojiObject.emoji, msg.id);
                  setShowEmojiPickerFor(null);
                }}
              />
            </div>
          )}
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