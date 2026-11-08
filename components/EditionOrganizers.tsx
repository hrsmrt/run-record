"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { EnrollmentTag } from "@/components/EnrollmentTag"

export type EditionOrganizer = {
    event_edition_id: number
    name: string | null
    gender: string | null
    enrollment_year: number | null
    is_me: boolean
}

// 開催回の幹事。メンバーなら誰でも幹事になれ、幹事はその開催回の記録をまとめて登録できる
export function EditionOrganizers({ editionId, organizers, canJoin, onChanged }: {
    editionId: number
    organizers: EditionOrganizer[]
    // 閲覧用アカウントは幹事になれない
    canJoin: boolean
    onChanged: () => void
}) {
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")
    const amOrganizer = organizers.some(o => o.is_me)
    if (organizers.length === 0 && !canJoin) return null

    const toggle = async () => {
        if (amOrganizer && !confirm("この開催回の幹事をやめますか？（登録した記録はそのまま残ります）")) return
        setBusy(true)
        setError("")
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setBusy(false); setError("ログインしてください"); return }
        const { error } = amOrganizer
            ? await supabase.from("edition_organizers").delete().eq("event_edition_id", editionId).eq("user_id", user.id)
            : await supabase.from("edition_organizers").insert({ event_edition_id: editionId, user_id: user.id })
        setBusy(false)
        if (error) { setError(`保存に失敗しました: ${error.message}`); return }
        onChanged()
    }

    return (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="font-bold text-gray-600">幹事</span>
            {organizers.length === 0
                ? <span className="text-gray-500">なし</span>
                : organizers.map((o, i) => (
                    <span key={i} className={o.gender === "female" ? "text-red-600" : ""}>
                        {o.name ?? "（退会したメンバー）"}<EnrollmentTag year={o.enrollment_year} />
                    </span>
                ))}
            {canJoin && (
                <button onClick={toggle} disabled={busy} className="text-blue-600 hover:underline disabled:opacity-50">
                    {amOrganizer ? "幹事をやめる" : "幹事になる"}
                </button>
            )}
            {amOrganizer && (
                <Link href={`/records/bulk?edition=${editionId}`} className="px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700">
                    記録をまとめて登録
                </Link>
            )}
            {error && <span className="text-red-600">{error}</span>}
        </div>
    )
}
