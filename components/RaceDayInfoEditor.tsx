"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

// メンバーなら誰でも入れられる種目の項目（スタート時刻・陸連公認と、その年のエントリー期間・参加費・定員）
export type RaceInfoFields = {
    start_time: string | null
    jaaf_certified: boolean | null
    entry_start_at: string | null
    entry_end_at: string | null
    entry_fee: number | null
    capacity: number | null
}
type RaceInfo = { id: number; name: string } & RaceInfoFields

// "09:00:00" → "9:00"
export const formatStartTime = (t: string | null) => t ? `${Number(t.substring(0, 2))}:${t.substring(3, 5)}` : ""
export const formatCertified = (v: boolean | null) => v == null ? "" : v ? "公認" : "非公認"

// datetime-local の値 ⇔ ISO 文字列（どちらもブラウザのタイムゾーン基準）
const pad = (n: number) => String(n).padStart(2, "0")
const toLocalInput = (iso: string | null) => {
    if (!iso) return ""
    const d = new Date(iso)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const fromLocalInput = (v: string) => v ? new Date(v).toISOString() : null

// 開催回の種目ごとの情報の入力（メンバーなら誰でも。種目名・距離などは管理人などが種目編集で直す）
export function RaceDayInfoEditor({ races, onSaved }: {
    races: RaceInfo[]
    // 保存した値を呼び出し元の表に反映する
    onSaved: (raceId: number, patch: Partial<RaceInfoFields>) => void
}) {
    const [open, setOpen] = useState(false)
    if (races.length === 0) return null
    if (!open) {
        return <button onClick={() => setOpen(true)} className="mt-1 text-xs text-blue-600 hover:underline">種目の情報を入力（エントリー期間・参加費・定員・スタート時刻・陸連公認）</button>
    }
    return (
        <div className="mt-1 flex flex-col gap-2 bg-white text-black border rounded p-2 text-xs">
            {races.map(r => <RaceInfoRow key={`${r.id}-${r.start_time}-${r.jaaf_certified}-${r.entry_start_at}-${r.entry_end_at}-${r.entry_fee}-${r.capacity}`} race={r} onSaved={onSaved} />)}
            <p className="text-gray-500">エントリー期間・参加費・定員はその年の値を入れてください（大会の公式サイトの募集要項など）。</p>
            <button onClick={() => setOpen(false)} className="self-start text-gray-600 hover:underline">閉じる</button>
        </div>
    )
}

function RaceInfoRow({ race, onSaved }: {
    race: RaceInfo
    onSaved: (raceId: number, patch: Partial<RaceInfoFields>) => void
}) {
    const initial = {
        time: race.start_time ? race.start_time.substring(0, 5) : "",
        certified: race.jaaf_certified == null ? "" : race.jaaf_certified ? "yes" : "no",
        start: toLocalInput(race.entry_start_at),
        end: toLocalInput(race.entry_end_at),
        fee: race.entry_fee != null ? String(race.entry_fee) : "",
        capacity: race.capacity != null ? String(race.capacity) : "",
    }
    const [v, setV] = useState(initial)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")
    const set = (k: keyof typeof initial) => (e: { target: { value: string } }) => setV(prev => ({ ...prev, [k]: e.target.value }))
    const dayDirty = v.time !== initial.time || v.certified !== initial.certified
    const entryDirty = v.start !== initial.start || v.end !== initial.end || v.fee !== initial.fee || v.capacity !== initial.capacity

    const save = async () => {
        const fee = v.fee.trim() === "" ? null : Number(v.fee)
        const capacity = v.capacity.trim() === "" ? null : Number(v.capacity)
        if (fee != null && (!Number.isInteger(fee) || fee < 0)) { setError("参加費は0以上の整数（円）で入れてください"); return }
        if (capacity != null && (!Number.isInteger(capacity) || capacity <= 0)) { setError("定員は1以上の整数で入れてください"); return }
        if (v.start && v.end && v.start > v.end) { setError("エントリーの開始が締切より後になっています"); return }
        setBusy(true)
        setError("")
        const supabase = createClient()
        const patch: Partial<RaceInfoFields> = {}
        if (dayDirty) {
            const startTime = v.time ? `${v.time}:00` : null
            const jaafCertified = v.certified === "" ? null : v.certified === "yes"
            const { error } = await supabase.rpc("set_race_day_info", { p_race_id: race.id, p_start_time: startTime, p_jaaf_certified: jaafCertified })
            if (error) { setBusy(false); setError(`保存に失敗しました: ${error.message}`); return }
            Object.assign(patch, { start_time: startTime, jaaf_certified: jaafCertified })
        }
        if (entryDirty) {
            const entry = { entry_start_at: fromLocalInput(v.start), entry_end_at: fromLocalInput(v.end), entry_fee: fee, capacity }
            const { error } = await supabase.rpc("set_race_entry_info", {
                p_race_id: race.id, p_start: entry.entry_start_at, p_end: entry.entry_end_at, p_fee: fee, p_capacity: capacity,
            })
            if (error) {
                setBusy(false)
                setError(`保存に失敗しました: ${error.message}`)
                if (Object.keys(patch).length > 0) onSaved(race.id, patch)
                return
            }
            Object.assign(patch, entry)
        }
        setBusy(false)
        onSaved(race.id, patch)
    }

    const input = "border rounded px-1 py-0.5 bg-white"
    return (
        <div className="flex flex-col gap-1 border-b pb-2 last:border-b-0">
            <span className="font-bold">{race.name}</span>
            <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1">
                    エントリー開始
                    <input type="datetime-local" value={v.start} onChange={set("start")} className={input} />
                </label>
                <label className="flex items-center gap-1">
                    締切
                    <input type="datetime-local" value={v.end} onChange={set("end")} className={input} />
                </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1">
                    参加費
                    <input type="number" inputMode="numeric" min={0} value={v.fee} onChange={set("fee")} className={`${input} w-24`} />円
                </label>
                <label className="flex items-center gap-1">
                    定員
                    <input type="number" inputMode="numeric" min={1} value={v.capacity} onChange={set("capacity")} className={`${input} w-24`} />人
                </label>
                <label className="flex items-center gap-1">
                    スタート
                    <input type="time" value={v.time} onChange={set("time")} className={input} />
                </label>
                <select value={v.certified} onChange={set("certified")} className={input} aria-label="陸連公認">
                    <option value="">公認は不明</option>
                    <option value="yes">陸連公認</option>
                    <option value="no">非公認</option>
                </select>
                {(dayDirty || entryDirty) && (
                    <button onClick={save} disabled={busy} className="px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">保存</button>
                )}
            </div>
            {error && <span className="text-red-600">{error}</span>}
        </div>
    )
}
