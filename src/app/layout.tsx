'use client'   // ← 必须加，否则 useEffect 会报错
import { useEffect } from 'react'
// 按你仓库实际路径写；看你 page.tsx 里怎么引的就怎么写
import { supabase } from '../../lib/supabase'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (hash.includes('access_token') && hash.includes('type=magiclink')) {
      supabase.auth.onAuthStateChange((_event: any, session: any) => {
        if (session?.user) window.location.reload()
      })
    }
  }, [])

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}