'use client';
import { useState, useEffect, useCallback } from 'react';
import { FileAttachment, DMMessage, UserPresence } from './types';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import Image from 'next/image';

interface DMMessageThreadProps {
  message: DMMessage;
  currentUserId: string;
  otherUser?: UserPresence;
  renderFileAttachment: (file: FileAttachment) => React.ReactNode;
}

export function DMMessageThread({ 
  message, 
  currentUserId,
  otherUser,
  renderFileAttachment 
}: DMMessageThreadProps) {
  const supabase = useSupabaseClient();
  const [hoveredMessageId, setHoveredMessageId] = useState<number | null>(null);
  const [showEmojiPickerFor, setShowEmojiPickerFor] = useState<number | null>(null);
  const [userAvatars, setUserAvatars] = useState<{ [userId: string]: string }>({});

  // Function to fetch user avatar
  const fetchUserAvatar = useCallback(async (userId: string) => {
    if (userAvatars[userId]) return;

    try {
      const { data, error } = await supabase
        .from('user_status')
        .select('avatar_path')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching user avatar:', error.message);
        return;
      }

      if (data?.avatar_path) {
        // Get public URL for avatar
        const { data: { publicUrl } } = supabase.storage
          .from('user-content')
          .getPublicUrl(data.avatar_path);

        setUserAvatars(prev => ({
          ...prev,
          [userId]: publicUrl
        }));
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error fetching user avatar:', error.message);
      } else {
        console.error('Unknown error fetching user avatar:', error);
      }
    }
  }, [supabase, userAvatars]);

  // Fetch current user's avatar
  useEffect(() => {
    fetchUserAvatar(currentUserId);
  }, [currentUserId, fetchUserAvatar]);

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
        <div className="flex items-start space-x-2">
          {message.sender_id !== currentUserId && (
            <div className="flex-shrink-0">
              {otherUser?.avatar_path ? (
                <Image
                  src={otherUser.avatar_path}
                  alt={otherUser.display_name}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-500">
                  <svg
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </div>
          )}
          <div className={`rounded-lg px-4 py-2 ${
            message.sender_id === currentUserId 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-100 dark:bg-gray-800'
          }`}>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                {message.sender_id === currentUserId ? (
                  userAvatars[currentUserId] ? (
                    <Image
                      src={userAvatars[currentUserId]}
                      alt="You"
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-500">
                      <svg
                        className="h-5 w-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )
                ) : (
                  otherUser?.avatar_path ? (
                    <Image
                      src={otherUser.avatar_path}
                      alt={otherUser.display_name}
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-500">
                      <svg
                        className="h-5 w-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {message.sender_id === currentUserId ? 'You' : otherUser?.display_name}
                </p>
                <p>{message.content}</p>
                {message.file && renderFileAttachment(message.file)}
                {renderReactions(message)}
              </div>
            </div>
          </div>
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