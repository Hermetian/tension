//app/components/ChatRoom.tsx
'use client'
declare global {
  interface Window {
    statusTimeout?: NodeJS.Timeout;
  }
}

import { useEffect, useRef, useState } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import type { Session } from '@supabase/auth-helpers-react'
import Image from "next/image"
import EmojiPicker from 'emoji-picker-react'
import { EmojiClickData } from 'emoji-picker-react'
import ChannelList from './ChannelList'
import UserList from './UserList'
import { useCallback } from 'react'
import { 
  UserPresence, 
  Message, 
  Channel, 
  DMChannel, 
  DMMessage,
  ChatContext,
  FileAttachment
} from './types'
import SearchBar from './SearchBar';
import { MessageThread } from './MessageThread';
import { DMMessageThread } from './DMMessageThread';
import { useRouter } from 'next/navigation'
import { VideoPlayer } from './VideoPlayer';

interface ChatRoomProps {
  session: Session
}

export default function ChatRoom({ session }: ChatRoomProps) {
  const supabase = useSupabaseClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [dmMessages, setDMMessages] = useState<DMMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [chatContext, setChatContext] = useState<ChatContext>({ type: 'channel' })
  const [searchResults, setSearchResults] = useState<(Message | DMMessage)[]>([])
  const [isShowingSearchResults, setIsShowingSearchResults] = useState(false)
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  //const [userStatus, setUserStatus] = useState<'active' | 'idle' | 'offline'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const router = useRouter();

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchMessages = useCallback(async (channelId: number) => {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *, 
        file,
        reactions:message_reactions(*)
      `)
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
    
    if (error) {
      console.error('Error fetching messages:', error)
      return
    }
    setMessages(data || [])
  }, [supabase])

  const fetchDMMessages = useCallback(async (channelId: number) => {
    const { data, error } = await supabase
      .from('dm_messages')
      .select(`
        *, 
        file,
        reactions:message_reactions!dm_message_id(*)
      `)
      .eq('dm_channel_id', channelId)
      .order('created_at', { ascending: true })
    
    if (error) {
      console.error('Error fetching DM messages:', error)
      return
    }
    setDMMessages(data || [])
  }, [supabase])

  const organizeMessagesIntoThreads = (messages: Message[]) => {
    const threads: { [key: number]: Message[] } = {};
    // Only messages without a parent_message_id should be considered top-level
    const topLevelMessages = messages.filter(message => {
      if (message.parent_message_id) {
        // If this is a reply, add it to the appropriate thread
        if (!threads[message.parent_message_id]) {
          threads[message.parent_message_id] = [];
        }
        threads[message.parent_message_id].push(message);
        return false; // Don't include it in topLevelMessages
      }
      return true; // Include only non-reply messages in topLevelMessages
    });
  
    // Sort both top-level messages and replies by creation time
    topLevelMessages.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  
    // Sort replies within each thread
    Object.keys(threads).forEach(threadId => {
      threads[Number(threadId)].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });
  
    return { threads, topLevelMessages };
  };

  const handleReplyClick = (messageId: number) => {
    setReplyingTo(messageId);
    // Use setTimeout to ensure the focus happens after the state update
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 0);
  }
  // Message subscription effect
  useEffect(() => {
    console.log('Setting up subscription for context:', chatContext);

    if (chatContext.type === 'channel' && chatContext.channel) {
      const channelId = chatContext.channel.id;
      console.log('Setting up channel subscription for channel:', channelId);

      const channel = supabase
        .channel(`messages-${channelId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `channel_id=eq.${channelId}`,
          },
          (payload) => {
            console.log('New message inserted:', payload);
            fetchMessages(channelId);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `channel_id=eq.${channelId}`,
          },
          (payload) => {
            console.log('Message updated:', payload);
            fetchMessages(channelId);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'message_reactions'
          },
          (payload) => {
            console.log('New reaction inserted:', payload);
            fetchMessages(channelId);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'message_reactions'
          },
          (payload) => {
            console.log('Reaction updated:', payload);
            fetchMessages(channelId);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'message_reactions'
          },
          (payload) => {
            console.log('Reaction deleted:', payload);
            fetchMessages(channelId);
          }
        )
        .subscribe((status) => {
          console.log(`Subscription status for channel ${channelId}:`, status);
        });

      console.log('Initial message fetch for channel:', channelId);
      fetchMessages(channelId);

      return () => {
        console.log('Cleaning up subscription for channel:', channelId);
        supabase.removeChannel(channel);
      };
    } else if (chatContext.type === 'dm' && chatContext.dmChannel) {
      console.log('Setting up DM subscription for channel:', chatContext.dmChannel.id);
      // Subscribe to DM messages
      const channel = supabase
        .channel(`dm-${chatContext.dmChannel.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'dm_messages',
          filter: `dm_channel_id=eq.${chatContext.dmChannel.id}`
        }, () => {
          fetchDMMessages(chatContext.dmChannel!.id);
        })
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reactions'
        }, () => {
          fetchDMMessages(chatContext.dmChannel!.id);
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'message_reactions'
        }, () => {
          fetchDMMessages(chatContext.dmChannel!.id);
        })
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'message_reactions'
        }, () => {
          fetchDMMessages(chatContext.dmChannel!.id);
        })
        .subscribe();

      fetchDMMessages(chatContext.dmChannel.id);

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [chatContext, fetchMessages, fetchDMMessages, supabase])

  useEffect(() => {
    let lastActive = new Date()
    let checkInterval: NodeJS.Timeout
  
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Start checking when page is hidden
        checkInterval = setInterval(async () => {
          const timeSinceActive = new Date().getTime() - lastActive.getTime()
          if (timeSinceActive >= 5000) { // 5 seconds
            await supabase
              .from('user_status')
              .upsert({
                user_id: session.user.id,
                email: session.user.email,
                last_seen: new Date().toISOString(),
                status: 'idle'
              })
              .select()
            clearInterval(checkInterval)
          }
        }, 1000)
      } else {
        // Clear check interval when page becomes visible
        if (checkInterval) {
          clearInterval(checkInterval)
        }
        lastActive = new Date()
      }
    }
  
    // Update lastActive timestamp on user activity
    const updateLastActive = () => {
      lastActive = new Date()
    }
  
    document.addEventListener('visibilitychange', handleVisibilityChange)
    document.addEventListener('mousemove', updateLastActive)
    document.addEventListener('keydown', updateLastActive)
    document.addEventListener('click', updateLastActive)
  
    return () => {
      if (checkInterval) clearInterval(checkInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('mousemove', updateLastActive)
      document.removeEventListener('keydown', updateLastActive)
      document.removeEventListener('click', updateLastActive)
    }
  }, [session, supabase])

  const fetchDefaultChannel = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('channels')
        .select()
        .eq('name', 'general')
        .single();
      
      if (error) {
        console.log('Error fetching general channel:', error);
        // If we can't find general channel, try to get any channel
        const { data: anyChannel, error: anyError } = await supabase
          .from('channels')
          .select()
          .limit(1)
          .single();

        if (anyError) {
          console.log('Error fetching any channel:', anyError);
          // If no channels exist, create general channel
          const { data: newChannel, error: createError } = await supabase
            .from('channels')
            .insert([
              {
                name: 'general',
                description: 'General discussion',
                created_by: session.user.id
              }
            ])
            .select()
            .single();

          if (createError) {
            console.error('Error creating general channel:', createError);
            return;
          }

          setChatContext({
            type: 'channel',
            channel: newChannel
          });
          return;
        }

        setChatContext({
          type: 'channel',
          channel: anyChannel
        });
        return;
      }

      setChatContext({
        type: 'channel',
        channel: data
      });
    } 
      catch (error) {
        console.error('Error in fetchDefaultChannel:', error);
      }
    }, [supabase, session])

  useEffect(() => {
    fetchDefaultChannel()
  }, [fetchDefaultChannel])

  const clearUnreadCount = async (dmChannel: DMChannel) => {
    if (dmChannel.last_message_from !== session.user.id) {
      const { error } = await supabase
        .from('dm_channels')
        .update({ unread_count: 0 })
        .eq('id', dmChannel.id)

      if (error) {
        console.error('Error clearing unread count:', error)
      }
    }
  }

  const getOrCreateDMChannel = async (otherUser: UserPresence) => {
    // First try to find existing DM channel
    const { data: existingChannel, error: fetchError } = await supabase
      .from('dm_channels')
      .select('*')
      .or(`user1_id.eq.${session.user.id},user2_id.eq.${session.user.id}`)
      .or(`user1_id.eq.${otherUser.id},user2_id.eq.${otherUser.id}`)
      .single()

    if (!fetchError && existingChannel) {
      return existingChannel
    }

    // If no channel exists, create one
    const { data: newChannel, error: createError } = await supabase
      .from('dm_channels')
      .insert([
        {
          user1_id: session.user.id,
          user2_id: otherUser.id
        }
      ])
      .select()
      .single()

    if (createError) {
      console.error('Error creating DM channel:', createError)
      return null
    }

    return newChannel
  }

  const handleChannelSelect = (channel: Channel) => {
    setChatContext({
      type: 'channel',
      channel
    })
    setDMMessages([])  // Clear DM messages
  }

  const handleUserSelect = async (user: UserPresence) => {
    const dmChannel = await getOrCreateDMChannel(user)
    if (dmChannel) {
      setChatContext({
        type: 'dm',
        dmChannel,
        otherUser: user
      })
      setMessages([])  // Clear channel messages
      await clearUnreadCount(dmChannel)  // Clear unread messages when opening the DM
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    let messageContent = newMessage.trim();
    let shouldGenerateAudio = false;
    let shouldGenerateVideo = false;
    let aiQuery = '';

    // Check for commands in any order
    const commands = messageContent.split(' ');
    const commandSet = new Set(commands.slice(0, 3)); // Look at first three potential commands

    // Check for /say command
    if (commandSet.has('/say')) {
      shouldGenerateAudio = true;
      messageContent = commands.slice(commandSet.has('/ai') ? 2 : 1).join(' ');
    }

    // Check for /see command
    if (commandSet.has('/see')) {
      shouldGenerateVideo = true;
      messageContent = commands.slice(commandSet.has('/ai') ? 2 : 1).join(' ');
    }

    // Check for /ai command
    if (commandSet.has('/ai')) {
      aiQuery = commands.slice((commandSet.has('/say') || commandSet.has('/see')) ? 2 : 1).join(' ');
      messageContent = aiQuery;
    }

    // Handle AI chat command
    if (aiQuery) {
      if (!aiQuery) {
        showNotification('Please provide a query after /ai', 'error');
        return;
      }

      if (chatContext.type === 'channel' && chatContext.channel) {
        try {
          showNotification('AI is thinking...', 'info');
          
          // Call the API route instead of direct function
          const response = await fetch('/api/ai', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'generate',
              query: aiQuery,
              channelId: chatContext.channel.id
            }),
          });

          if (!response.ok) throw new Error('AI request failed');
          
          const data = await response.json();
          messageContent = `Q: ${aiQuery}\n\nA: ${data.response}`;

          // Generate audio if /say was used
          let audioData;
          if (shouldGenerateAudio) {
            try {
              const ttsResponse = await fetch('/api/ai', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  action: 'tts',
                  text: data.response,
                }),
              });

              if (!ttsResponse.ok) {
                const errorData = await ttsResponse.json();
                throw new Error(errorData.error || 'TTS request failed');
              }
              const ttsData = await ttsResponse.json();
              audioData = ttsData.audio;
            } catch (error) {
              console.error('Error generating audio:', error);
              showNotification('Error generating audio: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
            }
          }

          // Generate video if /see was used
          if (shouldGenerateVideo) {
            try {
              const videoResponse = await fetch('/api/ai/generate-video', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  text: data.response,
                }),
              });

              if (!videoResponse.ok) {
                const errorData = await videoResponse.json();
                throw new Error(errorData.error || 'Video generation failed');
              }
              const videoData = await videoResponse.json();
              const fileAttachment: FileAttachment = {
                url: videoData.videoUrl,
                name: 'AI Generated Video',
                type: 'video/mp4',
                size: 0 // Size is unknown until video is downloaded
              };
              
              // Send AI response as a message with video
              const { error } = await supabase
                .from('messages')
                .insert([{
                  content: messageContent,
                  user_id: session.user.id,
                  username: 'AI Assistant',
                  channel_id: chatContext.channel.id,
                  audio: audioData,
                  file: fileAttachment
                }]);

              if (error) {
                console.error('Error sending AI response:', error);
                showNotification('Error sending AI response', 'error');
                return;
              }

              setNewMessage('');
              return;
            } catch (error) {
              console.error('Error generating video:', error);
              showNotification('Error generating video: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
            }
          }
          
          // Send AI response as a message if no video was generated
          if (!shouldGenerateVideo) {
            const { error } = await supabase
              .from('messages')
              .insert([{
                content: messageContent,
                user_id: session.user.id,
                username: 'AI Assistant',
                channel_id: chatContext.channel.id,
                audio: audioData
              }]);

            if (error) {
              console.error('Error sending AI response:', error);
              showNotification('Error sending AI response', 'error');
              return;
            }
          }

          setNewMessage('');
          return;
        } catch (error) {
          console.error('Error processing AI query:', error);
          showNotification('Error processing AI query', 'error');
          return;
        }
      } else if (chatContext.type === 'dm' && chatContext.dmChannel && chatContext.otherUser) {
        try {
          showNotification('AI is thinking...', 'info');
          
          // Call the API route for DM AI response
          const response = await fetch('/api/ai', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'generateDM',
              query: aiQuery,
              otherUserId: chatContext.otherUser.id,
              botPrompt: chatContext.otherUser.bot_prompt
            }),
          });

          if (!response.ok) throw new Error('AI request failed');
          
          const data = await response.json();
          messageContent = data.response;

          // Generate audio if /say was used
          let audioData;
          if (shouldGenerateAudio) {
            try {
              const ttsResponse = await fetch('/api/ai', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  action: 'tts',
                  text: data.response,
                }),
              });

              if (!ttsResponse.ok) {
                const errorData = await ttsResponse.json();
                throw new Error(errorData.error || 'TTS request failed');
              }
              const ttsData = await ttsResponse.json();
              audioData = ttsData.audio;
            } catch (error) {
              console.error('Error generating audio:', error);
              showNotification('Error generating audio: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
            }
          }

          // Generate video if /see was used
          if (shouldGenerateVideo) {
            try {
              const videoResponse = await fetch('/api/ai/generate-video', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  text: data.response,
                }),
              });

              if (!videoResponse.ok) {
                const errorData = await videoResponse.json();
                throw new Error(errorData.error || 'Video generation failed');
              }
              const videoData = await videoResponse.json();
              const fileAttachment: FileAttachment = {
                url: videoData.videoUrl,
                name: 'AI Generated Video',
                type: 'video/mp4',
                size: 0 // Size is unknown until video is downloaded
              };
              
              // Send AI response as a message with video
              const { error } = await supabase
                .from('dm_messages')
                .insert({
                  content: messageContent,
                  sender_id: chatContext.otherUser.id,
                  dm_channel_id: chatContext.dmChannel.id,
                  created_at: new Date().toISOString(),
                  audio: audioData,
                  file: fileAttachment
                });

              if (error) {
                console.error('Error sending AI response:', error);
                showNotification('Error sending AI response', 'error');
                return;
              }

              setNewMessage('');
              return;
            } catch (error) {
              console.error('Error generating video:', error);
              showNotification('Error generating video: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
            }
          }
          
          // Send AI response as a message if no video was generated
          if (!shouldGenerateVideo) {
            const { error } = await supabase
              .from('dm_messages')
              .insert({
                content: messageContent,
                sender_id: chatContext.otherUser.id,
                dm_channel_id: chatContext.dmChannel.id,
                created_at: new Date().toISOString(),
                audio: audioData
              });

            if (error) {
              console.error('Error sending AI response:', error);
              showNotification('Error sending AI response', 'error');
              return;
            }
          }

          setNewMessage('');
          return;
        } catch (error) {
          console.error('Error processing AI query:', error);
          showNotification('Error processing AI query', 'error');
          return;
        }
      }
    }

    // Handle clear command
    if (messageContent === '/clear') {
      console.log('Clear command detected'); // Debug log
      try {
        if (chatContext.type === 'channel') {
          console.log('Clearing channel...'); // Debug log
          // Check if user is admin
          const { data: userData } = await supabase
            .from('user_status')
            .select('email')
            .eq('user_id', session.user.id)
            .single();
  
          console.log('User data:', userData); // Debug log
  
          if (userData?.email !== 'cordwell@gmail.com') {
            showNotification('Only admin can delete channels', 'error');
            return;
          }
  
          // Delete messages first
          const { error: messagesError } = await supabase
            .from('messages')
            .delete()
            .eq('channel_id', chatContext.channel!.id);
  
          console.log('Messages deletion result:', messagesError); // Debug log
  
          // Then delete channel
          const { error: channelError } = await supabase
            .from('channels')
            .delete()
            .eq('id', chatContext.channel!.id);
  
          console.log('Channel deletion result:', channelError); // Debug log
  
          if (messagesError || channelError) {
            showNotification('Error clearing channel', 'error');
            return;
          }
  
          // Reset to general channel
          await fetchDefaultChannel();
          showNotification('Channel cleared successfully', 'success');
        } 
        else if (chatContext.type === 'dm') {
          console.log('Clearing DM...'); // Debug log
          // Delete messages first
          const { error: messagesError } = await supabase
            .from('dm_messages')
            .delete()
            .eq('dm_channel_id', chatContext.dmChannel!.id);
  
          console.log('DM messages deletion result:', messagesError); // Debug log
  
          // Then delete DM channel
          const { error: channelError } = await supabase
            .from('dm_channels')
            .delete()
            .eq('id', chatContext.dmChannel!.id);
  
          console.log('DM channel deletion result:', channelError); // Debug log
  
          if (messagesError || channelError) {
            showNotification('Error clearing DM conversation', 'error');
            return;
          }
  
          // Reset to default channel
          await fetchDefaultChannel();
          showNotification('DM conversation cleared successfully', 'success');
        }
        setNewMessage(''); // Clear input after successful clear
        return;
      } catch (error) {
        console.error('Error clearing conversation:', error);
        showNotification('Error clearing conversation', 'error');
        return;
      }
    }
  
    // Handle regular messages
    if (chatContext.type === 'channel' && chatContext.channel) {
      try {
        // Get user's display name first
        const { data: userData } = await supabase
          .from('user_status')
          .select('display_name')
          .eq('user_id', session.user.id)
          .single();

        // Generate audio if /say was used
        let audioData;
        if (shouldGenerateAudio) {
          try {
            const ttsResponse = await fetch('/api/ai', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                action: 'tts',
                text: messageContent,
              }),
            });

            if (!ttsResponse.ok) {
              const errorData = await ttsResponse.json();
              throw new Error(errorData.error || 'TTS request failed');
            }
            const ttsData = await ttsResponse.json();
            audioData = ttsData.audio;
          } catch (error) {
            console.error('Error generating audio:', error);
            showNotification('Error generating audio: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
          }
        }

        // Generate video if /see was used
        let fileAttachment;
        if (shouldGenerateVideo) {
          try {
            showNotification('Generating video...', 'info');
            const videoResponse = await fetch('/api/ai/generate-video', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ text: messageContent }),
            });
            
            if (!videoResponse.ok) {
              const errorData = await videoResponse.json();
              throw new Error(errorData.error || 'Video generation failed');
            }
            const videoData = await videoResponse.json();
            fileAttachment = {
              url: videoData.videoUrl,
              name: 'Generated Video',
              type: 'video/mp4',
              size: 0 // Size is unknown until video is downloaded
            };
            showNotification('Video generated successfully', 'success');
          } catch (error) {
            console.error('Error generating video:', error);
            showNotification('Error generating video: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
          }
        }

        const { data, error } = await supabase
          .from('messages')
          .insert([{
            content: messageContent,
            user_id: session.user.id,
            username: userData?.display_name || session.user.email,
            channel_id: chatContext.channel.id,
            parent_message_id: replyingTo,
            audio: audioData,
            file: fileAttachment
          }])
          .select();

        if (error) {
          throw error;
        }

        // Index the new message for RAG using the API route
        if (data) {
          try {
            const indexResponse = await fetch('/api/ai', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                action: 'index',
                messages: data
              }),
            });

            if (!indexResponse.ok) {
              console.error('Error indexing message');
            }
          } catch (error) {
            console.error('Error indexing message:', error);
          }
        }

        setNewMessage('');
        setReplyingTo(null);
      } catch (error) {
        console.error('Error sending message:', error);
        showNotification('Error sending message: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
        return;
      }
    }
    else if (chatContext.type === 'dm' && chatContext.dmChannel) {
      console.log('Sending DM, current user:', session.user.id);
      console.log('DM Channel before update:', chatContext.dmChannel);
      
      try {
        // First verify the DM channel exists
        const { data: channelCheck, error: checkError } = await supabase
          .from('dm_channels')
          .select('*')
          .eq('id', chatContext.dmChannel.id)
          .single();
    
        if (checkError || !channelCheck) {
          console.error('Could not find DM channel:', checkError);
          return;
        }

        // Generate audio if /say was used
        let audioData;
        if (shouldGenerateAudio) {
          try {
            const ttsResponse = await fetch('/api/ai', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                action: 'tts',
                text: messageContent,
              }),
            });

            if (!ttsResponse.ok) throw new Error('TTS request failed');
            const ttsData = await ttsResponse.json();
            audioData = ttsData.audio;
          } catch (error) {
            console.error('Error generating audio:', error);
            showNotification('Error generating audio', 'error');
          }
        }

        // Generate video if /see was used
        let fileAttachment;
        if (shouldGenerateVideo) {
          try {
            showNotification('Generating video...', 'info');
            const videoResponse = await fetch('/api/ai/generate-video', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                text: messageContent,
              }),
            });

            if (!videoResponse.ok) {
              const errorData = await videoResponse.json();
              throw new Error(errorData.error || 'Video generation failed');
            }
            const videoData = await videoResponse.json();
            fileAttachment = {
              url: videoData.videoUrl,
              name: 'Generated Video',
              type: 'video/mp4',
              size: 0 // Size is unknown until video is downloaded
            };
            showNotification('Video generated successfully', 'success');
          } catch (error) {
            console.error('Error generating video:', error);
            showNotification('Error generating video: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
          }
        }
    
        // Split into separate update and message operations
        const updateResult = await supabase
          .from('dm_channels')
          .update({
            unread_count: (channelCheck.unread_count || 0) + 1,
            last_message_from: session.user.id
          })
          .match({ id: channelCheck.id }); // Use match instead of eq
        
        if (updateResult.error) {
          console.error('Error updating unread count:', updateResult.error);
          return;
        }
    
        const messageResult = await supabase
          .from('dm_messages')
          .insert([{
            content: messageContent,
            sender_id: session.user.id,
            dm_channel_id: channelCheck.id,
            audio: audioData,
            file: fileAttachment
          }])
          .select();
    
        if (messageResult.error) {
          console.error('Error sending DM:', messageResult.error);
          return;
        }

        setNewMessage('');
      } catch (error) {
        console.error('Error in DM handling:', error);
      }
    }
    console.log('Message received:', newMessage.trim()); // Debug log

    setNewMessage('');
    setReplyingTo(null);
  }

  const handleLogout = async () => {
    try {
      await supabase
        .from('user_status')
        .upsert({
          user_id: session.user.id,
          email: session.user.email,
          last_seen: new Date().toISOString(),
          status: 'offline'
        })
        .select()
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Error during logout:', error)
    }
  }

  const handleEmojiClick = (emojiObject: EmojiClickData) => {
    setNewMessage((prevMsg) => prevMsg + emojiObject.emoji)
    setShowEmojiPicker(false)
  }
  
  const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB in bytes
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      showNotification('File size exceeds 50MB limit', 'error');
      e.target.value = '';
      return;
    }
  
    showNotification('Uploading file...', 'info');
  
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${session.user.id}/${fileName}`;
  
      const {error: uploadError} = await supabase.storage
        .from('chat-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
  
      if (uploadError) throw uploadError;
  
      // Get the public URL using the correct method
      const { data: { publicUrl } } = supabase.storage
        .from('chat-files')
        .getPublicUrl(filePath, {
          download: true
        });
  
      const fileAttachment: FileAttachment = {
        url: publicUrl,
        name: file.name,
        type: file.type,
        size: file.size
      };

      // Send message with file attachment
      let messageData;
      if (chatContext.type === 'channel' && chatContext.channel) {
        const { data, error } = await supabase
          .from('messages')
          .insert([{
            content: `Shared file: ${file.name}`,
            user_id: session.user.id,
            username: session.user.email,
            channel_id: chatContext.channel.id,
            file: fileAttachment
          }])
          .select();
          
        if (error) throw error;
        messageData = data;

        // Process PDF if applicable
        if (file.type === 'application/pdf') {
          try {
            await fetch('/api/ai', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                action: 'processPDF',
                filePath: publicUrl,
                fileId: messageData[0].id.toString(),
                fileName: file.name,
                channelId: chatContext.channel.id,
                uploaderId: session.user.id,
                uploaderName: session.user.email
              }),
            });
          } catch (error) {
            console.error('Error processing PDF:', error);
            showNotification('PDF uploaded but indexing failed', 'error');
          }
        }
      } else if (chatContext.type === 'dm' && chatContext.dmChannel) {
        await supabase
          .from('dm_messages')
          .insert([{
            content: `Shared file: ${file.name}`,
            sender_id: session.user.id,
            dm_channel_id: chatContext.dmChannel.id,
            file: fileAttachment
          }]);
      }

      showNotification('File uploaded successfully', 'success');
    } catch (error) {
      console.error('Error uploading file:', error);
      showNotification('Error uploading file', 'error');
    }

    // Clear the input
    e.target.value = '';
  };
  const renderFileAttachment = (file: FileAttachment) => {
    if (file.type.startsWith('image/')) {
      return (
        <a href={file.url} target="_blank" rel="noopener noreferrer">
          <Image 
            src={file.url} 
            alt={file.name}
            width={320}
            height={240}
            className="max-w-xs max-h-48 rounded-lg object-contain"
          />
        </a>
      );
    }

    if (file.type === 'video/mp4') {
      return <VideoPlayer videoUrl={file.url} />;
    }
  
    // For non-image/video files, show a download link
    return (
      <a 
        href={file.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center space-x-2 text-blue-500 hover:text-blue-600"
      >
        <span>📎</span>
        <span>{file.name}</span>
        <span className="text-xs text-gray-500">
          ({(file.size / 1024 / 1024).toFixed(2)} MB)
        </span>
      </a>
    );
  };

  return (
    <div className="flex h-screen flex-col">
      {notification && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg ${
          notification.type === 'success' ? 'bg-green-500' :
          notification.type === 'info' ? 'bg-blue-500' :
          'bg-red-500'
        } text-white`}>
          {notification.message}
        </div>
      )}
      <header className="border-b bg-white p-4 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image
              className="dark:invert"
              src="/next.svg"
              alt="Next.js logo"
              width={100}
              height={20}
              priority
            />
            <h1 className="text-xl font-semibold">TensionApp</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/settings')}
              className="rounded-lg bg-gray-100 p-2 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              title="Settings"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <button
              onClick={handleLogout}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <SearchBar 
      chatContext={chatContext}
      onResultsFound={(results) => {
        setSearchResults(results);
        setIsShowingSearchResults(true);
      }}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-64 flex-col border-r">
          <div className="flex-shrink-0">
            <ChannelList
              currentChannel={chatContext.type === 'channel' ? chatContext.channel || null : null}
              onChannelSelect={handleChannelSelect}
              session={session}
            />
          </div>
          <div className="flex-shrink-0 border-t">
            <UserList 
              session={session} 
              onUserSelect={handleUserSelect} 
            />
          </div>
        </div>

        <div className="flex flex-1 flex-col">
          <div className="border-b p-4">
            <h2 className="text-lg font-semibold">
              {chatContext.type === 'channel' 
                ? `#${chatContext.channel?.name}`
                : `Chat with ${chatContext.otherUser?.display_name || chatContext.otherUser?.email}`
              }
            </h2>
            {chatContext.type === 'channel' && chatContext.channel?.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {chatContext.channel.description}
              </p>
            )}
          </div>

          <main className="flex-1 overflow-y-auto p-4">
            {isShowingSearchResults ? (
              <div>
                <div className="mb-4 flex justify-between">
                  <h3 className="text-lg font-semibold">
                    Search Results ({searchResults.length})
                  </h3>
                  <button
                    onClick={() => setIsShowingSearchResults(false)}
                    className="text-blue-500 hover:text-blue-600"
                  >
                    Back to Messages
                  </button>
                </div>
                <div className="space-y-4">
                  {searchResults.map((result) => {
                    const isCurrentUser = 
                      (chatContext.type === 'channel' && 'user_id' in result && result.user_id === session.user.id) ||
                      (chatContext.type === 'dm' && 'sender_id' in result && result.sender_id === session.user.id);
                    const username = chatContext.type === 'channel' 
                      ? ('username' in result ? result.username : '')
                      : (isCurrentUser ? 'You' : chatContext.otherUser?.email);

                    return (
                      <div
                        key={result.id}
                        className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                      >
                        <div 
                          className={`rounded-lg px-4 py-2 ${
                            isCurrentUser 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-gray-100 dark:bg-gray-800'
                          }`}
                        >
                          <div className="flex flex-col">
                            <div className="flex items-center justify-between gap-4">
                              <p className="text-sm font-medium">{username}</p>
                              <span className="text-xs opacity-75">
                                {new Date(result.created_at).toLocaleString()}
                              </span>
                            </div>
                            <p>{result.content}</p>
                            {result.file && renderFileAttachment(result.file)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              ) : (
                <div className="space-y-4">
                  {chatContext.type === 'channel' ? (
                    (() => {
                      // First, organize messages into threads and top-level messages
                      const { threads, topLevelMessages } = organizeMessagesIntoThreads(messages);
                      
                      // Then render each top-level message with its replies
                      return topLevelMessages.map(message => (
                        <MessageThread
                          key={message.id}
                          message={message}
                          replies={threads[message.id] || []}
                          currentUserId={session.user.id}
                          onReply={handleReplyClick}
                          renderFileAttachment={renderFileAttachment}
                        />
                      ));
                    })()
                  ) : (
                dmMessages.map((message) => (
                  <DMMessageThread
                    key={message.id}
                    message={message}
                    currentUserId={session.user.id}
                    otherUser={chatContext.otherUser}
                    renderFileAttachment={renderFileAttachment}
                  />
                ))
              )}
            </div>
            )}
          </main>

          <form onSubmit={sendMessage} className="border-t p-4">
            {replyingTo && (
              <div className="mb-2 rounded bg-gray-100 p-2 text-sm dark:bg-gray-800">
                Replying to a message •
                <button
                type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    setReplyingTo(null)
                  }}
                  className="ml-2 text-blue-500 hover:text-blue-600"
                >
                  Cancel
                </button>
              </div>
            )}
            <div className="flex space-x-4">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={async (e) => {
                    setNewMessage(e.target.value)
                    
                    // Update database with active status
                    await supabase
                      .from('user_status')
                      .upsert({
                        user_id: session.user.id,
                        email: session.user.email,
                        last_seen: new Date().toISOString(),
                        status: 'active'
                      })
                      .select()

                    // Clear any existing timeout
                    if (window.statusTimeout) {
                      clearTimeout(window.statusTimeout)
                    }

                  }}
                  placeholder={
                    replyingTo
                    ? "Reply to message"
                    : chatContext.type === 'channel'
                      ? `Message #${chatContext.channel?.name}`
                      : `Message ${chatContext.otherUser?.display_name || chatContext.otherUser?.email}`
                  }
                  className="w-full rounded-lg border bg-transparent px-4 py-2 focus:border-blue-500 focus:outline-none dark:border-gray-700"
                />
                
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700"
                >
                  😊
                </button>
                <button
                type="button"
                onClick={() => document.getElementById('file-input')?.click()}
                className="absolute right-12 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700"
              >
                <span className="text-xl">+</span>
              </button>
                {showEmojiPicker && (
                  <div className="absolute bottom-full right-0 mb-2">
                    <EmojiPicker
                      onEmojiClick={handleEmojiClick}
                      lazyLoadEmojis={true}
                    />
                  </div>
                )}
              </div>

              <input
                id="file-input"
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept="image/*,video/*,application/pdf"  // Adjust accepted file types as needed
                data-max-size={MAX_FILE_SIZE}  // This is for documentation purposes
              />
              <button
                type="submit"
                className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}