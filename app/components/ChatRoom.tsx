'use client'
declare global {
  interface Window {
    statusTimeout?: NodeJS.Timeout;
  }
}


import { useEffect, useState } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import type { Session } from '@supabase/auth-helpers-react'
import Image from "next/image"
import EmojiPicker from 'emoji-picker-react'
import { EmojiClickData } from 'emoji-picker-react'
import ChannelList from './ChannelList'
import UserList from './UserList'

interface Message {
  id: number
  content: string
  user_id: string
  username: string
  channel_id: number
  created_at: string
}

interface Channel {
  id: number
  name: string
  description?: string
  created_by: string
  created_at: string
}

interface ChatRoomProps {
  session: Session
}


export default function ChatRoom({ session }: ChatRoomProps) {
  const supabase = useSupabaseClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [userStatus, setUserStatus] = useState<'active' | 'idle' | 'offline'>('idle')
  const handleEmojiClick = (emojiObject: EmojiClickData) => {
    setNewMessage((prevMsg) => prevMsg + emojiObject.emoji)
    setShowEmojiPicker(false)
  }

  useEffect(() => {
    fetchDefaultChannel()
  }, [])

  useEffect(() => {
    if (!currentChannel) return

    const channel = supabase
      .channel('messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `channel_id=eq.${currentChannel.id}`
      }, payload => {
        setMessages(messages => [...messages, payload.new as Message])
      })
      .subscribe()

    fetchMessages()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentChannel])

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

  const fetchDefaultChannel = async () => {
    // First try to get the general channel
    const { data: generalChannel, error: generalError } = await supabase
      .from('channels')
      .select()
      .eq('name', 'general')
      .single()
    
    if (!generalError && generalChannel) {
      setCurrentChannel(generalChannel)
      return
    }

    // If no general channel, get the first available channel
    const { data: firstChannel, error: firstChannelError } = await supabase
      .from('channels')
      .select()
      .order('created_at', { ascending: true })
      .limit(1)
      .single()
    
    if (!firstChannelError && firstChannel) {
      setCurrentChannel(firstChannel)
      return
    }

    // If still no channel, create the general channel
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
      .single()
    
    if (createError) {
      console.error('Error creating default channel:', createError)
      return
    }

    if (newChannel) {
      setCurrentChannel(newChannel)
    }
  }

  const fetchMessages = async () => {
    if (!currentChannel) return

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('channel_id', currentChannel.id)
      .order('created_at', { ascending: true })
    
    if (error) {
      console.error('Error fetching messages:', {
        error,
        details: error.details,
        message: error.message,
        hint: error.hint
      })
      return
    }
    setMessages(data || [])
}

const sendMessage = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!newMessage.trim() || !currentChannel) return

  // Update status to active
  await supabase
    .from('user_status')
    .upsert({
      user_id: session.user.id,
      email: session.user.email,
      last_seen: new Date().toISOString(),
      status: 'active'
    })
    .select()

  const { error } = await supabase
    .from('messages')
    .insert([
      {
        content: newMessage,
        user_id: session.user.id,
        username: session.user.email,
        channel_id: currentChannel.id
      }
    ])

  if (error) {
    console.error('Error sending message:', error)
    return
  }
  setNewMessage('')
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

  return (
    <div className="flex h-screen flex-col">
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
          <button
            onClick={handleLogout}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - Channels and Users */}
        <div className="flex w-64 flex-col border-r">
          <div className="flex-shrink-0">
            <ChannelList
              currentChannel={currentChannel}
              onChannelSelect={setCurrentChannel}
              session={session}
            />
          </div>
          <div className="flex-shrink-0 border-t">
            <UserList session={session} />
          </div>
        </div>

        {/* Main chat area */}
        <div className="flex flex-1 flex-col">
          {currentChannel && (
            <div className="border-b p-4">
              <h2 className="text-lg font-semibold">#{currentChannel.name}</h2>
              {currentChannel.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {currentChannel.description}
                </p>
              )}
            </div>
          )}

          <main className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.user_id === session.user.id ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div className={`rounded-lg px-4 py-2 ${
                    message.user_id === session.user.id 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 dark:bg-gray-800'
                  }`}>
                    <p className="text-sm font-medium">{message.username}</p>
                    <p>{message.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </main>

          <form onSubmit={sendMessage} className="border-t p-4">
            <div className="flex space-x-4">
              <div className="relative flex-1">
              <input
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
                  placeholder={currentChannel ? `Message #${currentChannel.name}` : 'Select a channel'}
                  disabled={!currentChannel}
                  className="w-full rounded-lg border bg-transparent px-4 py-2 focus:border-blue-500 focus:outline-none dark:border-gray-700"
                />
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700"
                >
                  😊
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
              <button
                type="submit"
                disabled={!currentChannel}
                className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
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