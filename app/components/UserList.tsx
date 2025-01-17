'use client'
import { useEffect, useState } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import type { Session } from '@supabase/auth-helpers-react'
import { useCallback } from 'react'
import { UserPresence } from './types'
import Image from 'next/image'

interface UserListProps {
  session: Session
  onUserSelect: (user: UserPresence) => void
}

interface UserListProps {
  session: Session
  onUserSelect: (user: UserPresence) => void
}

export default function UserList({ session, onUserSelect }: UserListProps) {
  const supabase = useSupabaseClient()
  const [users, setUsers] = useState<UserPresence[]>([])

  const fetchUsers = useCallback(async () => {
    // First get user statuses
    const { data: statusData, error: statusError } = await supabase
      .from('user_status')
      .select('*, bot_prompt')
      .gte('last_seen', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    if (statusError || !statusData) return

    // Then get unread counts from DM channels
    const { data: dmData} = await supabase
      .from('dm_channels')
      .select('*')
      .or(`user1_id.eq.${session.user.id},user2_id.eq.${session.user.id}`)

      const userArray = await Promise.all(statusData.map(async user => {
        // Find DM channel with this user
        const dmChannel = dmData?.find(dm => 
          (dm.user1_id === user.user_id && dm.user2_id === session.user.id) ||
          (dm.user2_id === user.user_id && dm.user1_id === session.user.id)
        )
      
        // Only count as unread if the last message was from the other user
        const unreadCount = dmChannel?.last_message_from === user.user_id ? 
          dmChannel.unread_count : 0

        // Get public URL for avatar if it exists
        let avatarUrl = null;
        if (user.avatar_path) {
          const { data: { publicUrl } } = supabase.storage
            .from('user-content')
            .getPublicUrl(user.avatar_path);
          avatarUrl = publicUrl;
        }
      
        return {
          id: user.user_id,
          email: user.email,
          display_name: user.display_name || user.email,
          status: user.status,
          lastSeen: user.last_seen,
          unreadCount,
          avatar_path: avatarUrl,
          bot_prompt: user.bot_prompt
        }
      }))

    const sortedUsers = userArray.sort((a, b) => {
      // Show users with unread messages first
      if ((a.unreadCount || 0) > 0 && !(b.unreadCount || 0)) return -1
      if (!(a.unreadCount || 0) && (b.unreadCount || 0) > 0) return 1

      // Then by status
      const statusPriority: Record<string, number> = { 
        active: 0, 
        idle: 1, 
        offline: 2 
      }
      if (a.status !== b.status) {
        return (statusPriority[a.status] || 2) - (statusPriority[b.status] || 2)
      }
      return a.display_name.localeCompare(b.display_name)
    })

    setUsers(sortedUsers)
  }, [supabase, session])

  useEffect(() => {
    // Set up 1-second refresh interval.
    const refreshInterval = setInterval(fetchUsers, 1000)
    
    // Initial fetch
    fetchUsers()

    // Subscribe to real-time changes as a backup
    const channel = supabase
      .channel('user-status-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'user_status' 
        },
        fetchUsers
      )
      .subscribe()

    return () => {
      clearInterval(refreshInterval)
      channel.unsubscribe()
    }
  }, [session, supabase, fetchUsers])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500'
      case 'idle': return 'bg-yellow-500'
      default: return 'bg-gray-400'
    }
  }

  const formatLastSeen = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return 'just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    return date.toLocaleDateString()
  }

  const handleUserClick = (user: UserPresence) => {
    if (user.id !== session.user.id) {  // Don't allow DM with self
      console.log('Clicked user:', user)
      onUserSelect(user)
    }
  }

  return (
    <div className="flex h-full flex-col p-3">
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-gray-500">
          Users — {users.filter(u => u.status !== 'offline').length} online
        </h2>
      </div>
      <div className="space-y-1 overflow-y-auto">
        {users.map((user) => (
          <div
            key={user.id}
            onClick={() => handleUserClick(user)}
            className="flex flex-col rounded px-2 py-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer relative"
          >
            <div className="flex items-center space-x-2">
              <div className="relative">
                {user.avatar_path ? (
                  <Image
                    src={user.avatar_path}
                    alt={user.display_name}
                    width={24}
                    height={24}
                    className="rounded-full"
                  />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-gray-500 text-sm font-medium">
                    {user.display_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${getStatusColor(user.status)}`} />
              </div>
              <span className="truncate">
                {user.email === session.user.email ? `${user.display_name} (you)` : user.display_name}
              </span>
              {user.unreadCount ? (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center">
                  <div className="bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {user.unreadCount}
                  </div>
                </div>
              ) : null}
            </div>
            {user.status === 'offline' && (
              <div className="ml-8 text-xs text-gray-500">
                Last seen {formatLastSeen(user.lastSeen)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}