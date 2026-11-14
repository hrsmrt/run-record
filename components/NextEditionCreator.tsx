"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { formatYmd, nextDateOf } from "@/lib/event-catalog"
import type { EventSchedule } from "@/lib/event-info"

type SourceEdition = {
    id: number
    held_on: string | null
    edition_number: number | null
    races: { id: number; name: string; distance_km: number }[]
}

// 大会詳細の「次回の開催回を追加」（これからの回が未登録の大会。メンバーなら誰でも）。
// 開催日は推定日を入れておき、種目は前回の回から名前・距離・制限時間・高低差・スタート時刻・陸連公認を写す（add_next_edition()）。
// エントリー期間・参加費・定員はその年の値なので写さない
export function NextEditionCreator({ eventId, editions, schedule, onCreated }: {
    eventId: number
    editions: SourceEdition[]
    schedule: EventSchedule | null
    onCreated: () => void
}) {
    const sources = editions.filter(ed => ed.held_on && ed.races.length > 0).sort((a, b) => b.held_on!.localeCompare(a.held_on!))
    const latest = [...editions].filter(ed => ed.held_on).sort((a, b) => b.held_on!.localeCompare(a.held_on!))[0]
    const estimate = nextDateOf(editions.map(ed => ({ ...ed, event_id: eventId, name: null })), schedule ?? undefined)
    const [open, setOpen] = useState(false)
    const [date, setDate] = useState("")
    const [number, setNumber] = useState(latest?.edition_number != null ? String(latest.edition_number + 1) : "")
    const [copyFrom, setCopyFrom] = useState<number | "">(sources[0]?.id ?? "")
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")

    if (!open) {
        return (
            // 開催の間隔などを読み終えてから開くことがあるので、推定日は開いたときに入れる
            <button onClick={() => { setDate(estimate?.estimated ? estimate.date : ""); setOpen(true) }} className="self-start text-sm text-blue-600 hover:underline">
                ＋ 次回の開催回を追加{estimate?.estimated && `（推定 ${formatYmd(estimate.date)}）`}
            </button>
        )
    }

    const add = async () => {
        if (!date) { setError("開催日を入れてください"); return }
        const n = number.trim() === "" ? null : Number(number)
        if (n != null && (!Number.isInteger(n) || n <= 0)) { setError("第〇回は正の整数で入れてください"); return }
        setBusy(true)
        setError("")
        const { error } = await createClient().rpc("add_next_edition", {
            p_event_id: eventId, p_held_on: date, p_edition_number: n, p_copy_from: copyFrom === "" ? null : copyFrom,
        })
        setBusy(false)
        if (error) { setError(error.code === "23505" ? "この開催日の回はすでに登録されています" : `追加に失敗しました: ${error.message}`); return }
        setOpen(false)
        onCreated()
    }

    const source = sources.find(s => s.id === copyFrom)
    const input = "border rounded px-1 py-0.5 bg-white"
    return (
        <div className="flex flex-col gap-2 bg-white text-black border rounded p-2 text-sm max-w-2xl">
            <p className="font-bold">次回の開催回を追加</p>
            <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1">
                    開催日
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className={input} />
                </label>
                <label className="flex items-center gap-1">
                    第
                    <input type="number" inputMode="numeric" min={1} value={number} onChange={e => setNumber(e.target.value)} className={`${input} w-20`} />
                    回
                </label>
            </div>
            {estimate?.estimated && <p className="text-xs text-gray-500">開催日は前回（{formatYmd(estimate.from!)}）からの推定です。公式サイトで確かめて直してください。</p>}
            <label className="flex flex-wrap items-center gap-1">
                種目を写す元
                <select value={copyFrom} onChange={e => setCopyFrom(e.target.value ? Number(e.target.value) : "")} className={input}>
                    <option value="">写さない（種目は後で追加）</option>
                    {sources.map(s => <option key={s.id} value={s.id}>{formatYmd(s.held_on!)}{s.edition_number != null ? ` 第${s.edition_number}回` : ""}（{s.races.length}種目）</option>)}
                </select>
            </label>
            {source && (
                <p className="text-xs text-gray-600">
                    写す種目: {source.races.map(r => `${r.name}（${r.distance_km}km）`).join("・")}。
                    名前・距離・制限時間・高低差・スタート時刻・陸連公認を写します。エントリー期間・参加費・定員は、追加した後に「種目の情報を入力」で入れてください。
                </p>
            )}
            <div className="flex items-center gap-3">
                <button onClick={add} disabled={busy} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{busy ? "追加しています..." : "追加"}</button>
                <button onClick={() => setOpen(false)} className="text-gray-600 hover:underline">やめる</button>
            </div>
            {error && <p className="text-red-600">{error}</p>}
        </div>
    )
}
