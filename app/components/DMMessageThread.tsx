'use client';
import { useState } from 'react';
import { FileAttachment, DMMessage } from './types';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

interface DMMessageThreadProps {
  message: DMMessage;
  currentUserId: string;
  otherUserEmail?: string;
  renderFileAttachment: (file: FileAttachment) => React.ReactNode;
}

export function DMMessageThread({ 
  message, 
  currentUserId,
  otherUserEmail,
  renderFileAttachment 
}: DMMessageThreadProps) {
  const supabase = useSupabaseClient();
  const [hoveredMessageId, setHoveredMessageId] = useState<number | null>(null);
  const [showEmojiPickerFor, setShowEmojiPickerFor] = useState<number | null>(null);

  // Function to handle adding a reaction
  const addReaction = async (emoji: string, messageId: number) => {
    // Check if the user has already reacted to this message
    const { data: existingReaction, error: fetchError } = await supabase
      .from('message_reactions')
      .select('*')
      .eq('dm_message_id', messageId)
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
            dm_message_id: messageId,
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
  const renderReactions = (msg: DMMessage) => {
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

  return (
    <div
      className={`flex ${message.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}
      onMouseEnter={() => setHoveredMessageId(message.id)}
      onMouseLeave={() => setHoveredMessageId(null)}
    >
      <div className="relative">
        {/* Hover buttons */}
        {hoveredMessageId === message.id && (
          <div
            className={`absolute ${
              message.sender_id === currentUserId ? '-left-20' : '-right-20'
            } top-1/2 -translate-y-1/2 flex space-x-2`}
          >
            {/* React button */}
            <button
              onClick={() => setShowEmojiPickerFor(message.id)}
              className="text-gray-400 hover:text-gray-600"
              title="React to this message"
            >
              😊
            </button>
          </div>
        )}
        
        {/* Message content */}
        <div className={`rounded-lg px-4 py-2 ${
          message.sender_id === currentUserId 
            ? 'bg-blue-500 text-white' 
            : 'bg-gray-100 dark:bg-gray-800'
        }`}>
          <p className="text-sm font-medium">
            {message.sender_id === currentUserId ? 'You' : otherUserEmail}
          </p>
          <p>{message.content}</p>
          {message.file && renderFileAttachment(message.file)}
          {renderReactions(message)}
        </div>

        {/* Emoji Picker */}
        {showEmojiPickerFor === message.id && (
          <div className="absolute z-10">
            <EmojiPicker
              onEmojiClick={async (emojiObject: EmojiClickData) => {
                await addReaction(emojiObject.emoji, message.id);
                setShowEmojiPickerFor(null);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
} 