'use client'
import { useEffect, useState } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import type { Session } from '@supabase/auth-helpers-react'

interface UserPresence {
  id: string
  email: string
  status: 'active' | 'idle' | 'offline'
  lastSeen: string
}

interface UserListProps {
  session: Session
}

export default function UserList({ session }: UserListProps) {
  const supabase = useSupabaseClient()
  const [users, setUsers] = useState<UserPresence[]>([])

  // Function to fetch users
  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('user_status')
      .select('*')
      .gte('last_seen', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    if (!error && data) {
      const userArray = data.map(user => ({
        id: user.user_id,
        email: user.email,
        status: user.status,
        lastSeen: user.last_seen
      }))

      const sortedUsers = userArray.sort((a, b) => {
        const statusPriority: Record<string, number> = { 
          active: 0, 
          idle: 1, 
          offline: 2 
        }
        if (a.status !== b.status) {
          return (statusPriority[a.status] || 2) - (statusPriority[b.status] || 2)
        }
        return a.email.localeCompare(b.email)
      })

      setUsers(sortedUsers)
    }
  }

  useEffect(() => {
    // Set up 1-second refresh interval
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
  }, [session, supabase])

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
            className="flex flex-col rounded px-2 py-1 text-sm text-gray-700 dark:text-gray-300"
          >
            <div className="flex items-center space-x-2">
              <div className={`h-2 w-2 flex-shrink-0 rounded-full ${getStatusColor(user.status)}`}></div>
              <span className="truncate">
                {user.email === session.user.email ? `${user.email} (you)` : user.email}
              </span>
            </div>
            {user.status === 'offline' && (
              <div className="ml-4 text-xs text-gray-500">
                Last seen {formatLastSeen(user.lastSeen)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}