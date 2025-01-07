'use client'
import { useEffect, useState } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import type { Session } from '@supabase/auth-helpers-react'
import Image from "next/image"
import ChannelList from './ChannelList'

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
    await supabase.auth.signOut()
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
        <div className="w-64 border-r">
          <ChannelList
            currentChannel={currentChannel}
            onChannelSelect={setCurrentChannel}
            session={session}
          />
        </div>

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
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={currentChannel ? `Message #${currentChannel.name}` : 'Select a channel'}
                disabled={!currentChannel}
                className="flex-1 rounded-lg border bg-transparent px-4 py-2 focus:border-blue-500 focus:outline-none dark:border-gray-700"
              />
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