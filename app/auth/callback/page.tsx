// app/auth/callback/page.tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function AuthCallback() {
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const handleAuth = async () => {
      const currentUrl = new URL(window.location.href)
      const oauthError = currentUrl.searchParams.get("error")
      const oauthErrorDesc = currentUrl.searchParams.get("error_description")
      const nextPath = currentUrl.searchParams.get("next") || undefined

      // エラー付きで戻ってきた場合
      if (oauthError) {
        setErrorMessage(oauthErrorDesc || "認証に失敗しました。もう一度お試しください。")
        return
      }

      const supabase = createClient()

      try {
        // URLに必要な情報がなければ交換しない（PKCE/implicitの不一致回避）
        const hasCode = !!currentUrl.searchParams.get("code")
        const hash = window.location.hash || ""
        const hasTokens = /access_token=/.test(hash) || /refresh_token=/.test(hash)
        if (!hasCode && !hasTokens) {
          setErrorMessage("無効なリダイレクトです。リンクの有効期限切れ、またはURLが不完全です。")
          return
        }

        // URLのクエリ/ハッシュからセッション確立
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href)
        if (error) {
          console.error("Auth error:", error)
          setErrorMessage(error.message || "認証に失敗しました。もう一度お試しください。")
          return
        }

        // 認証成功後はプロフィール作成へ遷移
        router.replace("/profile/create")
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "不明なエラーが発生しました"
        console.error("Auth exception:", e)
        setErrorMessage(msg)
      }
    }

    handleAuth()
  }, [router])

  if (errorMessage) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm text-center">
          <p className="mb-4 text-red-600">{errorMessage}</p>
          <button
            className="px-4 py-2 rounded bg-blue-600 text-white"
            onClick={() => router.replace("/auth/login")}
          >
            ログイン画面へ戻る
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm text-center">
        <p>ログイン処理中...</p>
      </div>
    </div>
  )
}
