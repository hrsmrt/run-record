// app/auth/callback/page.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function AuthCallback() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // 認証リンクに `error` が付いてくるケースへ対応
  const oauthError = useMemo(() => searchParams?.get("error") ?? null, [searchParams])
  const oauthErrorDesc = useMemo(() => searchParams?.get("error_description") ?? null, [searchParams])
  const nextPath = useMemo(() => searchParams?.get("next") ?? undefined, [searchParams])

  useEffect(() => {
    const handleAuth = async () => {
      // エラー付きで戻ってきた場合
      if (oauthError) {
        setErrorMessage(oauthErrorDesc || "認証に失敗しました。もう一度お試しください。")
        return
      }

      const supabase = createClient()

      try {
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
  }, [router, oauthError, oauthErrorDesc, nextPath])

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
