"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { safeNextPath } from "@/lib/admin"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Mode = "loading" | "enroll" | "verify" | "done" | "error"

// 2段階認証（TOTP）の登録と、ログイン後のコード入力
export default function MfaPage() {
    const router = useRouter()
    const [mode, setMode] = useState<Mode>("loading")
    const [factorId, setFactorId] = useState("")
    const [qrCode, setQrCode] = useState("")
    const [secret, setSecret] = useState("")
    const [code, setCode] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [nextPath, setNextPath] = useState("/")
    // 開発時の二重実行で登録が2回走らないようにする
    const started = useRef(false)

    useEffect(() => {
        if (started.current) return
        started.current = true

        const init = async () => {
            setNextPath(safeNextPath(new URLSearchParams(window.location.search).get("next")))
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.replace("/auth/login"); return }

            const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
            if (aal?.currentLevel === "aal2") { setMode("done"); return }

            const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()
            if (listError) { setError(listError.message); setMode("error"); return }

            const verified = factors.totp.find(f => f.status === "verified")
            if (verified) {
                setFactorId(verified.id)
                setMode("verify")
                return
            }

            // 途中でやめた未確認の登録が残っていれば消してから登録し直す
            for (const f of factors.all.filter(f => f.factor_type === "totp" && f.status === "unverified")) {
                await supabase.auth.mfa.unenroll({ factorId: f.id })
            }
            const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
                factorType: "totp",
                friendlyName: `Runner's Record ${new Date().toISOString().slice(0, 10)}`,
            })
            if (enrollError) { setError(enrollError.message); setMode("error"); return }
            setFactorId(enrolled.id)
            const qr = enrolled.totp.qr_code
            setQrCode(qr.startsWith("data:") ? qr : `data:image/svg+xml;utf-8,${encodeURIComponent(qr)}`)
            setSecret(enrolled.totp.secret)
            setMode("enroll")
        }
        init()
    }, [router])

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)
        const supabase = createClient()
        const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() })
        setIsLoading(false)
        if (error) {
            setError("コードが違うか、有効期限が切れています。認証アプリの最新のコードを入力してください")
            return
        }
        router.push(nextPath)
        router.refresh()
    }

    return (
        <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
            <div className="w-full max-w-sm">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-2xl">2段階認証</CardTitle>
                        <CardDescription>
                            {mode === "enroll" && "認証アプリで QR コードを読み取り、表示された6桁のコードを入力してください"}
                            {mode === "verify" && "認証アプリに表示されている6桁のコードを入力してください"}
                            {mode === "done" && "2段階認証は完了しています"}
                            {mode === "loading" && "読み込み中..."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {mode === "error" && <p className="text-sm text-red-500">エラーが発生しました{error ? `（${error}）` : ""}</p>}

                        {mode === "done" && (
                            <Button className="w-full" onClick={() => router.push(nextPath)}>続ける</Button>
                        )}

                        {(mode === "enroll" || mode === "verify") && (
                            <form onSubmit={handleVerify} className="flex flex-col gap-4">
                                {mode === "enroll" && (
                                    <>
                                        {/* eslint-disable-next-line @next/next/no-img-element -- data URL の QR コード */}
                                        <img src={qrCode} alt="2段階認証の QR コード" className="mx-auto w-48 h-48 bg-white" />
                                        <details className="text-xs text-gray-500">
                                            <summary className="cursor-pointer">QR コードを読み取れない場合</summary>
                                            <p className="mt-1">認証アプリに次のキーを手入力してください</p>
                                            <code className="block mt-1 p-2 bg-gray-100 rounded break-all select-all">{secret}</code>
                                        </details>
                                    </>
                                )}
                                <div className="grid gap-2">
                                    <Label htmlFor="mfa-code">認証コード</Label>
                                    <Input
                                        id="mfa-code"
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        pattern="[0-9]{6}"
                                        maxLength={6}
                                        required
                                        value={code}
                                        onChange={e => setCode(e.target.value)}
                                    />
                                </div>
                                {error && <p className="text-sm text-red-500">{error}</p>}
                                <Button type="submit" className="w-full" disabled={isLoading}>
                                    {isLoading ? "確認中..." : mode === "enroll" ? "登録する" : "認証する"}
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>
                <p className="mt-4 text-xs text-gray-500">
                    ※ 2段階認証は管理者機能（大会情報の編集、他のメンバーの記録の登録・編集）に必要です。
                    認証アプリを紛失した場合は、Supabase ダッシュボードで登録を削除してから登録し直してください。
                </p>
            </div>
        </div>
    )
}
