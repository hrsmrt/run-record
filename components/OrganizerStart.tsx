"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { RacePicker } from "@/components/RacePicker"
import type { RaceOption } from "@/components/RaceInput"

// 記録係として記録をまとめて登録する入口。大会 → 開催日 → 種目を選び（なければ追加し）、その開催回の記録係になって一括登録へ進む
export function OrganizerStart() {
    const router = useRouter()
    const [race, setRace] = useState<RaceOption | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")

    const start = async () => {
        if (!race) return
        setBusy(true)
        setError("")
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setBusy(false); setError("ログインしてください"); return }
        // すでに記録係なら何もしない（主キーが重なったときのエラーは無視する）
        const { error } = await supabase.from("edition_organizers").insert({ event_edition_id: race.editionId, user_id: user.id })
        if (error && error.code !== "23505") { setBusy(false); setError(`記録係になれませんでした: ${error.message}`); return }
        router.push(`/records/bulk?edition=${race.editionId}`)
    }

    return (
        <div className="max-w-4xl mx-auto p-4 text-black flex flex-col gap-4">
            <h1 className="text-2xl font-bold">記録をまとめて登録（記録係）</h1>
            <p className="text-sm text-gray-600">
                まとめて登録したい大会・開催日・種目を選んでください。見つからなければその場で追加できます。
                選んだ開催回の記録係になり、メンバーの記録をまとめて登録できます。
            </p>
            <RacePicker value={race?.id ?? null} onChange={setRace} />
            <div className="flex items-center gap-3">
                <button onClick={start} disabled={!race || busy} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                    {busy ? "準備中..." : "この開催回の記録係になって登録へ進む"}
                </button>
                {race && <span className="text-sm">{race.label}</span>}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
    )
}
