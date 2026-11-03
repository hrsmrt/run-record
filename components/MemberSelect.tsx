"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type Member = { user_id: string; name: string | null; pending_auth: boolean }

// 管理者が記録の登録先・編集対象のメンバーを選ぶプルダウン
// admin_members ビューは admin のときだけ行を返す（名前と ID のみ）
export function MemberSelect({ selfId, value, onChange, className }: {
    selfId: string
    value: string
    onChange: (userId: string) => void
    className?: string
}) {
    const [members, setMembers] = useState<Member[]>([])
    const [error, setError] = useState("")

    useEffect(() => {
        const fetch = async () => {
            const supabase = createClient()
            const { data, error } = await supabase.from("admin_members").select("user_id, name, pending_auth")
            if (error) { setError(error.message); return }
            setMembers(((data ?? []) as Member[]).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")))
        }
        fetch()
    }, [])

    if (error) return <span className="text-sm text-red-600">メンバー一覧の読み込みに失敗しました: {error}</span>

    const others = members.filter(m => m.user_id !== selfId)
    return (
        <select value={value} onChange={e => onChange(e.target.value)} className={className}>
            <option value={selfId}>自分</option>
            {others.map(m => (
                <option key={m.user_id} value={m.user_id}>
                    {m.name ?? "名前未設定"}{m.pending_auth ? "（アカウントなし）" : ""}
                </option>
            ))}
        </select>
    )
}
