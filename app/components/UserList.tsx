'use client'
import { useEffect, useState } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import type { Session } from '@supabase/auth-helpers-react'

interface UserPresence {
    id: string
    email: string
    presence_ref: string
    timestamp: string
  }

interface UserListProps {
  session: Session
}

export default function UserList({ session }: UserListProps) {
  const supabase = useSupabaseClient()
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([])

  useEffect(() => {
    // Initialize presence channel
    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: session.user.id,
        },
      },
    })

    // Handle presence state changes
    channel.on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState()
      
      // Deduplicate users by their ID, keeping only the most recent presence
      const uniqueUsers = Object.values(presenceState)
        .flat()
        .reduce((acc: { [key: string]: UserPresence }, presence: any) => {
          // If we haven't seen this user or this presence is more recent, update it
          if (!acc[presence.userId] || 
              new Date(presence.timestamp) > new Date(acc[presence.userId].timestamp)) {
            acc[presence.userId] = {
              id: presence.userId,
              email: presence.email,
              presence_ref: presence.presence_ref,
              timestamp: presence.timestamp
            }
          }
          return acc
        }, {})

      // Convert back to array and sort by email
      const uniqueUsersArray = Object.values(uniqueUsers)
        .sort((a, b) => a.email.localeCompare(b.email))
      
      setOnlineUsers(uniqueUsersArray)
    })

    // Subscribe to presence channel and track user
    channel
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: session.user.id,
            email: session.user.email,
            timestamp: new Date().toISOString(),
          })
        }
      })

    // Cleanup subscription
    return () => {
      channel.unsubscribe()
    }
  }, [session])

  return (
    <div className="flex h-full flex-col p-3">
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-gray-500">Online — {onlineUsers.length}</h2>
      </div>
      <div className="space-y-1 overflow-y-auto">
        {onlineUsers.map((user) => (
          <div
            key={user.presence_ref}
            className="flex items-center space-x-2 rounded px-2 py-1 text-sm text-gray-700 dark:text-gray-300"
          >
            <div className="h-2 w-2 flex-shrink-0 rounded-full bg-green-500"></div>
            <span className="truncate">
              {user.email === session.user.email ? `${user.email} (you)` : user.email}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}