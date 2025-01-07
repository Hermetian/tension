'use client'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import Image from "next/image"
import ChatRoom from './components/ChatRoom'

export default function Home() {
  const session = useSession()
  const supabase = useSupabaseClient()

  if (!session) {
    return (
      <div className="grid min-h-screen place-items-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <Image
              className="mx-auto dark:invert"
              src="/next.svg"
              alt="Next.js logo"
              width={180}
              height={38}
              priority
            />
            <h2 className="mt-6 text-2xl font-bold">Welcome to TensionApp</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Please sign in to continue
            </p>
          </div>
          
          <Auth 
            supabaseClient={supabase}
            appearance={{ 
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#404040',
                    brandAccent: '#2d2d2d'
                  }
                }
              }
            }}
            providers={['github', 'google']}
          />
        </div>
      </div>
    )
  }

  return <ChatRoom session={session} />
}