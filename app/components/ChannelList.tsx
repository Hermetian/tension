'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import type { Session } from '@supabase/auth-helpers-react'
import { Channel } from './types'

interface ChannelListProps {
  currentChannel: Channel | null
  onChannelSelect: (channel: Channel) => void
  session: Session
}

export default function ChannelList({ currentChannel, onChannelSelect, session }: ChannelListProps) {
  const supabase = useSupabaseClient()
  const [channels, setChannels] = useState<Channel[]>([])
  const [newChannelName, setNewChannelName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const fetchChannels = useCallback(async () => {
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .order('name')
    
    if (error) {
      console.error('Error fetching channels:', error)
      return
    }
    setChannels(data || [])
  }, [supabase]);

  useEffect(() => {
    fetchChannels()
    
    const channel = supabase
      .channel('channel-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'channels'
      }, () => {
        console.log('Channel change detected, refreshing list')
        fetchChannels()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchChannels, supabase])

  const createChannel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChannelName.trim()) return

    const { error } = await supabase
      .from('channels')
      .insert([
        {
          name: newChannelName.trim().toLowerCase(),
          created_by: session.user.id
        }
      ])

    if (error) {
      console.error('Error creating channel:', error)
      alert('Error creating channel. The name might already be taken.')
    } else {
      setNewChannelName('')
      setIsCreating(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-gray-50 p-3 dark:bg-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Channels</h2>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          {isCreating ? '×' : '+'}
        </button>
      </div>

      {isCreating && (
        <form onSubmit={createChannel} className="mb-4">
          <input
            type="text"
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
            placeholder="New channel name"
            className="mb-2 w-full rounded border bg-white px-2 py-1 dark:bg-gray-700"
          />
          <button
            type="submit"
            className="w-full rounded bg-blue-500 px-2 py-1 text-white hover:bg-blue-600"
          >
            Create Channel
          </button>
        </form>
      )}

      <div className="flex-1 space-y-1 overflow-y-auto">
        {channels.map((channel) => (
          <button
            key={channel.id}
            onClick={() => onChannelSelect(channel)}
            className={`w-full rounded px-2 py-1 text-left ${
              currentChannel?.id === channel.id
                ? 'bg-blue-500 text-white'
                : 'hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            # {channel.name}
          </button>
        ))}
      </div>
    </div>
  )
}