"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { EnrollmentTag } from "@/components/EnrollmentTag"
import { type PracticeRsvp, RSVP_LABELS, type RsvpStatus } from "@/lib/practices"

const STATUSES: RsvpStatus[] = ["yes", "maybe", "no"]
const BUTTON_STYLE: Record<RsvpStatus, string> = {
    yes: "bg-blue-600 text-white border-blue-600",
    maybe: "bg-yellow-400 text-black border-yellow-400",
    no: "bg-gray-500 text-white border-gray-500",
}

// 練習予定の参加ボタン（参加・検討中・不参加とひとこと）と、答えた人の一覧
export function RsvpPanel({ practiceId, rsvps, canAnswer, closed, onChanged }: {
    practiceId: number
    rsvps: PracticeRsvp[]
    // 閲覧用アカウントは答えられない
    canAnswer: boolean
    // 締切を過ぎた
    closed: boolean
    onChanged: () => void
}) {
    const mine = rsvps.find(r => r.is_me)
    const [note, setNote] = useState(mine?.note ?? "")
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")

    const answer = async (status: RsvpStatus | null) => {
        setBusy(true)
        setError("")
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setBusy(false); setError("ログインしてください"); return }
        const { error } = status == null
            ? await supabase.from("practice_rsvps").delete().eq("practice_id", practiceId).eq("user_id", user.id)
            : await supabase.from("practice_rsvps").upsert(
                { practice_id: practiceId, user_id: user.id, status, note: note.trim() || null, updated_at: new Date().toISOString() },
                { onConflict: "practice_id,user_id" },
            )
        setBusy(false)
        if (error) { setError(`保存に失敗しました: ${error.message}`); return }
        onChanged()
    }

    return (
        <div className="flex flex-col gap-2 bg-white p-3 text-sm">
            {canAnswer && (closed ? (
                <p className="text-gray-600">参加の締切を過ぎています。{mine && `（あなたの回答: ${RSVP_LABELS[mine.status]}）`}</p>
            ) : (
                <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        {STATUSES.map(s => (
                            <button
                                key={s}
                                onClick={() => answer(s)}
                                disabled={busy}
                                aria-pressed={mine?.status === s}
                                className={`px-4 py-1.5 rounded border font-bold disabled:opacity-50 ${mine?.status === s ? BUTTON_STYLE[s] : "bg-white hover:bg-gray-50"}`}
                            >
                                {RSVP_LABELS[s]}
                            </button>
                        ))}
                        {mine && <button onClick={() => answer(null)} disabled={busy} className="text-xs text-gray-600 hover:underline">回答を取り消す</button>}
                    </div>
                    <label className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-gray-600">ひとこと（任意）</span>
                        <input value={note} maxLength={100} onChange={e => setNote(e.target.value)} placeholder="例: 途中から、10kmだけ" className="border rounded px-2 py-1 w-56" />
                        {mine && note.trim() !== (mine.note ?? "") && (
                            <button onClick={() => answer(mine.status)} disabled={busy} className="text-xs text-blue-600 hover:underline">ひとことを保存</button>
                        )}
                    </label>
                    {error && <p className="text-red-600">{error}</p>}
                </div>
            ))}
            {STATUSES.map(s => {
                const list = rsvps.filter(r => r.status === s)
                if (list.length === 0) return null
                return (
                    <div key={s} className="flex flex-wrap gap-x-3 gap-y-0.5">
                        <span className="font-bold">{RSVP_LABELS[s]} {list.length}人:</span>
                        {list.map((r, i) => (
                            <span key={i} className={r.gender === "female" ? "text-red-600" : ""}>
                                {r.name ?? "（退会したメンバー）"}<EnrollmentTag year={r.enrollment_year} />
                                {r.note && <span className="text-xs text-gray-500">（{r.note}）</span>}
                            </span>
                        ))}
                    </div>
                )
            })}
            {rsvps.length === 0 && <p className="text-gray-500">まだ回答はありません。</p>}
        </div>
    )
}
