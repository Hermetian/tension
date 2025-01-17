'use client'

import { useEffect, useState, useRef } from 'react'
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function SettingsPage() {
  const supabase = useSupabaseClient()
  const session = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    display_name: '',
    bot_prompt: ''
  })

  useEffect(() => {
    if (!session?.user?.id) {
      router.push('/')
      return
    }

    async function loadUserData() {
      try {
        const { data, error } = await supabase
          .from('user_status')
          .select('*')
          .eq('user_id', session?.user?.id)
          .single()

        if (error) throw error

        setFormData({
          email: session?.user?.email ?? '',
          display_name: (data?.display_name || session?.user?.email) ?? '',
          bot_prompt: data?.bot_prompt || ''
        })

        // If avatar_path exists, get the public URL
        if (data?.avatar_path) {
          const { data: { publicUrl } } = supabase.storage
            .from('user-content')
            .getPublicUrl(data.avatar_path)
          setAvatarUrl(publicUrl)
        } else {
          setAvatarUrl(null)
        }
      } catch (error) {
        console.error('Error loading user data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadUserData()
  }, [session, supabase, router])

  const uploadAvatar = async (file: File) => {
    if (!session?.user?.id) return
    
    try {
      setUploading(true)

      // Create a unique file name
      const fileExt = file.name.split('.').pop()
      const fileName = `${session.user.id}-${Math.random()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      // Upload the file to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('user-content')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Update the user's avatar_path in the database with the storage path
      const { error: updateError } = await supabase
        .from('user_status')
        .update({ avatar_path: filePath })
        .eq('user_id', session.user.id)

      if (updateError) throw updateError

      // Get the public URL for display
      const { data: { publicUrl } } = supabase.storage
        .from('user-content')
        .getPublicUrl(filePath)

      setAvatarUrl(publicUrl)
      setMessage({
        text: 'Avatar updated successfully!',
        type: 'success'
      })
    } catch (error: any) {
      setMessage({
        text: error.message || 'Error uploading avatar',
        type: 'error'
      })
    } finally {
      setUploading(false)
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return

    const file = e.target.files[0]
    const maxSize = 5 * 1024 * 1024 // 5MB
    
    if (file.size > maxSize) {
      setMessage({
        text: 'File size must be less than 5MB',
        type: 'error'
      })
      return
    }

    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      setMessage({
        text: 'File must be an image',
        type: 'error'
      })
      return
    }

    await uploadAvatar(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.user?.id) return
    
    setLoading(true)

    try {
      // If email is being changed
      if (formData.email !== session.user.email) {
        const { error: updateError } = await supabase.auth.updateUser({
          email: formData.email
        })

        if (updateError) throw updateError

        setMessage({
          text: 'Please check your new email for a confirmation link.',
          type: 'success'
        })
      }

      // Update display name and bot prompt
      const { error: profileError } = await supabase
        .from('user_status')
        .update({
          display_name: formData.display_name,
          bot_prompt: formData.bot_prompt
        })
        .eq('user_id', session.user.id)

      if (profileError) throw profileError

      setMessage({
        text: 'Settings updated successfully!',
        type: 'success'
      })
    } catch (error: any) {
      setMessage({
        text: error.message || 'An error occurred while updating settings.',
        type: 'error'
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">User Settings</h1>
          <button
            onClick={() => router.push('/')}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            Back to Chat
          </button>
        </div>

        {message && (
          <div
            className={`mb-4 rounded-lg p-4 ${
              message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="mb-8">
          <div className="flex items-center space-x-4">
            <div className="relative h-20 w-20">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt="Avatar"
                  width={80}
                  height={80}
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-200 text-gray-500">
                  <svg
                    className="h-10 w-10"
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
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 rounded-full bg-blue-500 p-2 text-white hover:bg-blue-600"
                disabled={uploading}
              >
                {uploading ? (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                )}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <div>
              <h3 className="text-lg font-medium">Profile Picture</h3>
              <p className="text-sm text-gray-500">
                Upload a profile picture. Max size: 5MB
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full rounded-lg border bg-white px-4 py-2 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
              required
            />
          </div>

          <div>
            <label htmlFor="display_name" className="mb-2 block text-sm font-medium">
              Display Name
            </label>
            <input
              type="text"
              id="display_name"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              className="w-full rounded-lg border bg-white px-4 py-2 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
              required
            />
          </div>

          <div>
            <label htmlFor="bot_prompt" className="mb-2 block text-sm font-medium">
              Bot Prompt
            </label>
            <textarea
              id="bot_prompt"
              value={formData.bot_prompt}
              onChange={(e) => setFormData({ ...formData, bot_prompt: e.target.value })}
              className="h-40 w-full rounded-lg border bg-white px-4 py-2 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
              maxLength={1000}
            />
            <p className="mt-1 text-sm text-gray-500">
              {formData.bot_prompt.length}/1000 characters
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )
} 