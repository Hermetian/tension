'use client';
import { useState, useEffect } from 'react';
import { Message, FileAttachment } from './types';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import Image from 'next/image';

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
  const [userAvatars, setUserAvatars] = useState<Record<string, string>>({});

  // Function to fetch user avatar
  const fetchUserAvatar = async (userId: string) => {
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
  };

  // Fetch avatar for message author and reply authors
  useEffect(() => {
    fetchUserAvatar(message.user_id);
    replies.forEach(reply => fetchUserAvatar(reply.user_id));
  }, [message.user_id, replies]);

  // Function to render a single message
  const renderMessage = (msg: Message, isReply: boolean = false) => {
    const isCurrentUser = msg.user_id === currentUserId;

    return (
      <div
        key={msg.id}
        className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} ${isReply ? 'ml-8 mt-2' : ''}`}
        onMouseEnter={() => setHoveredMessageId(msg.id)}
        onMouseLeave={() => setHoveredMessageId(null)}
      >
        <div className="relative">
          {/* Hover buttons */}
          {hoveredMessageId === msg.id && (
            <div
              className={`absolute ${
                isCurrentUser ? '-left-20' : '-right-20'
              } top-1/2 -translate-y-1/2 flex space-x-2`}
            >
              {/* React button */}
              <button
                onClick={() => setShowEmojiPickerFor(msg.id)}
                className="text-gray-400 hover:text-gray-600"
                title="React to this message"
              >
                😊
              </button>
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
            </div>
          )}

          <div
            className={`rounded-lg px-4 py-2 ${
              isCurrentUser ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-800'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                {userAvatars[msg.user_id] ? (
                  <Image
                    src={userAvatars[msg.user_id]}
                    alt={msg.username}
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
              <div className="flex-1">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium">{msg.username}</p>
                  <span className="text-xs opacity-75">
                    {new Date(msg.created_at).toLocaleString()}
                  </span>
                </div>
                <p>{msg.content}</p>
                {msg.file && renderFileAttachment(msg.file)}
                {/* Render reactions */}
                {msg.reactions && msg.reactions.length > 0 && (
                  <div className="mt-1 flex space-x-2">
                    {Object.entries(
                      msg.reactions.reduce((acc: Record<string, number>, reaction) => {
                        acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
                        return acc;
                      }, {})
                    ).map(([emoji, count]) => (
                      <div
                        key={emoji}
                        className="flex items-center space-x-1 rounded-full bg-blue-600 px-2 py-1 text-sm text-white"
                      >
                        <span>{emoji}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
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
  };

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

  return (
    <div className="space-y-2">
      {renderMessage(message)}
      {replies.length > 0 && (
        <div className="border-l-2 border-gray-200 pl-4">
          {replies.map((reply) => renderMessage(reply, true))}
        </div>
      )}
    </div>
  );
}