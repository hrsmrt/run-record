"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

type RaceDayInfo = { id: number; name: string; start_time: string | null; jaaf_certified: boolean | null }

// "09:00:00" → "9:00"
export const formatStartTime = (t: string | null) => t ? `${Number(t.substring(0, 2))}:${t.substring(3, 5)}` : ""
export const formatCertified = (v: boolean | null) => v == null ? "" : v ? "公認" : "非公認"

// 開催回の種目ごとのスタート時刻・陸連公認の入力（メンバーなら誰でも。種目の他の項目は管理人などが種目編集で直す）
export function RaceDayInfoEditor({ races, onSaved }: {
    races: RaceDayInfo[]
    // 保存した値を呼び出し元の表に反映する
    onSaved: (raceId: number, startTime: string | null, jaafCertified: boolean | null) => void
}) {
    const [open, setOpen] = useState(false)
    if (races.length === 0) return null
    if (!open) {
        return <button onClick={() => setOpen(true)} className="mt-1 text-xs text-blue-600 hover:underline">スタート時刻・陸連公認を入力</button>
    }
    return (
        <div className="mt-1 flex flex-col gap-1 bg-white text-black border rounded p-2 text-xs">
            {races.map(r => <RaceDayInfoRow key={`${r.id}-${r.start_time}-${r.jaaf_certified}`} race={r} onSaved={onSaved} />)}
            <button onClick={() => setOpen(false)} className="self-start text-gray-600 hover:underline">閉じる</button>
        </div>
    )
}

function RaceDayInfoRow({ race, onSaved }: {
    race: RaceDayInfo
    onSaved: (raceId: number, startTime: string | null, jaafCertified: boolean | null) => void
}) {
    const [time, setTime] = useState(race.start_time ? race.start_time.substring(0, 5) : "")
    const [certified, setCertified] = useState(race.jaaf_certified == null ? "" : race.jaaf_certified ? "yes" : "no")
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")
    const dirty = time !== (race.start_time ? race.start_time.substring(0, 5) : "")
        || certified !== (race.jaaf_certified == null ? "" : race.jaaf_certified ? "yes" : "no")

    const save = async () => {
        setBusy(true)
        setError("")
        const startTime = time ? `${time}:00` : null
        const jaafCertified = certified === "" ? null : certified === "yes"
        const { error } = await createClient().rpc("set_race_day_info", {
            p_race_id: race.id, p_start_time: startTime, p_jaaf_certified: jaafCertified,
        })
        setBusy(false)
        if (error) { setError(`保存に失敗しました: ${error.message}`); return }
        onSaved(race.id, startTime, jaafCertified)
    }

    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold min-w-[8rem]">{race.name}</span>
            <label className="flex items-center gap-1">
                スタート
                <input type="time" value={time} onChange={e => setTime(e.target.value)} className="border rounded px-1 py-0.5 bg-white" />
            </label>
            <select value={certified} onChange={e => setCertified(e.target.value)} className="border rounded px-1 py-0.5 bg-white" aria-label="陸連公認">
                <option value="">公認は不明</option>
                <option value="yes">陸連公認</option>
                <option value="no">非公認</option>
            </select>
            {dirty && (
                <button onClick={save} disabled={busy} className="px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">保存</button>
            )}
            {error && <span className="text-red-600">{error}</span>}
        </div>
    )
}
