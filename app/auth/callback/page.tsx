// app/auth/callback/page.tsx
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleAuth = async () => {
      const supabase = createClient()
      // URLのクエリパラメータからセッションを取得して保存
      const { error } = await supabase.auth.exchangeCodeForSession(window.location.href)

      if (error) {
        console.error("Auth error:", error)
      } else {
        // 認証成功したらプロフィール登録画面へリダイレクト
        router.replace("/profile/create")
      }
    }
    handleAuth()
  }, [router])

  return <p>ログイン処理中...</p>
}
