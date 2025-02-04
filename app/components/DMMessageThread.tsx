'use client';
import { useState, useEffect, useCallback } from 'react';
import { FileAttachment, DMMessage, UserPresence } from './types';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import Image from 'next/image';
import { AudioPlayer } from './AudioPlayer';

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
  const [userAvatars, setUserAvatars] = useState<{ [userId: string]: { url: string | null; display_name: string } }>({});

  // Function to fetch user avatar
  const fetchUserAvatar = useCallback(async (userId: string) => {
    if (userAvatars[userId]) return;

    try {
      const { data, error } = await supabase
        .from('user_status')
        .select('avatar_path, display_name')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching user avatar:', error.message);
        return;
      }

      if (data) {
        // Get public URL for avatar if it exists
        let avatarUrl = null;
        if (data.avatar_path) {
          const { data: { publicUrl } } = supabase.storage
            .from('user-content')
            .getPublicUrl(data.avatar_path);
          avatarUrl = publicUrl;
        }

        setUserAvatars(prev => ({
          ...prev,
          [userId]: {
            url: avatarUrl,
            display_name: data.display_name
          }
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

  // Fetch other user's avatar
  useEffect(() => {
    if (otherUser?.id) {
      fetchUserAvatar(otherUser.id);
    }
  }, [otherUser?.id, fetchUserAvatar]);

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

  // Function to get user display name
  const getUserDisplayName = (userId: string) => {
    if (userId === currentUserId) return 'You';
    return userAvatars[userId]?.display_name || otherUser?.display_name || 'Unknown User';
  };

  // Function to get user avatar URL
  const getUserAvatarUrl = (userId: string) => {
    const userAvatar = userAvatars[userId]?.url;
    if (userAvatar) return userAvatar;
    
    // If it's the other user and we have their avatar_path but no URL yet
    if (userId === otherUser?.id && otherUser?.avatar_path) {
      const { data: { publicUrl } } = supabase.storage
        .from('user-content')
        .getPublicUrl(otherUser.avatar_path);
      return publicUrl;
    }
    
    return null;
  };

  // Function to render user avatar
  const renderAvatar = (userId: string) => {
    const avatarUrl = getUserAvatarUrl(userId);
    const displayName = getUserDisplayName(userId);

    if (avatarUrl) {
      return (
        <Image
          src={avatarUrl}
          alt={displayName}
          width={32}
          height={32}
          className="rounded-full"
        />
      );
    }

    // Fallback avatar with first letter of display name
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-500">
        {displayName.charAt(0).toUpperCase()}
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

        <div className={`rounded-lg px-4 py-2 ${
          message.sender_id === currentUserId 
            ? 'bg-blue-500 text-white' 
            : 'bg-gray-100 dark:bg-gray-800'
        }`}>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              {renderAvatar(message.sender_id)}
            </div>
            <div className="flex-1">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">
                  {getUserDisplayName(message.sender_id)}
                </span>
                <span className="text-xs opacity-75 ml-4">
                  {new Date(message.created_at).toLocaleString()}
                </span>
              </div>
              <p>{message.content}</p>
              {message.file && renderFileAttachment(message.file)}
              {message.audio && (
                <div className="mt-2">
                  <AudioPlayer audioData={message.audio} />
                </div>
              )}
              {renderReactions(message)}
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