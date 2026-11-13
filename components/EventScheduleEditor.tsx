"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { HELD_STATUSES, HELD_STATUS_LABELS, INTERVAL_LABELS, INTERVAL_YEARS, type HeldStatus } from "@/lib/event-info"

export type ScheduleInfoRow = {
    held_status: HeldStatus
    interval_years: number
    schedule_updated_by_name: string | null
    schedule_updated_at: string | null
}

const formatLocalDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

// 大会詳細の「開催」（開催中・休止中・終了と、毎年・隔年など）。メンバーなら誰でも選び直せる（すぐ保存）。
// 休止中・終了の大会は次の開催日を推定せず、間隔は推定で前回の年に足す年数
export function EventScheduleEditor({ eventId, info, canEdit, onChanged }: {
    eventId: number
    info: ScheduleInfoRow | null
    canEdit: boolean
    onChanged: () => void
}) {
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")
    const status = info?.held_status ?? "active"
    const interval = info?.interval_years ?? 1

    const save = async (next: { status: HeldStatus; interval: number }) => {
        setBusy(true)
        setError("")
        const { error } = await createClient().rpc("set_event_schedule_info", { p_event_id: eventId, p_status: next.status, p_interval: next.interval })
        setBusy(false)
        if (error) { setError(`保存に失敗しました: ${error.message}`); return }
        onChanged()
    }

    const select = "border rounded px-1 py-0.5 bg-white text-sm disabled:opacity-50"
    return (
        <>
            <dt className="text-gray-500">開催</dt>
            <dd className="flex flex-col gap-0.5">
                {canEdit ? (
                    <span className="flex flex-wrap items-center gap-2">
                        <select value={status} disabled={busy} onChange={e => save({ status: e.target.value as HeldStatus, interval })} className={select} aria-label="開催の状況">
                            {HELD_STATUSES.map(s => <option key={s} value={s}>{HELD_STATUS_LABELS[s]}</option>)}
                        </select>
                        <select value={interval} disabled={busy} onChange={e => save({ status, interval: Number(e.target.value) })} className={select} aria-label="開催の間隔">
                            {INTERVAL_YEARS.map(n => <option key={n} value={n}>{INTERVAL_LABELS[n]}</option>)}
                        </select>
                    </span>
                ) : (
                    <span>{HELD_STATUS_LABELS[status]}・{INTERVAL_LABELS[interval]}</span>
                )}
                {status !== "active" && <span className="text-xs text-gray-500">{HELD_STATUS_LABELS[status]}の大会は、大会一覧で次の開催日を推定しません</span>}
                {info?.schedule_updated_at && (
                    <span className="text-xs text-gray-500">{info.schedule_updated_by_name ?? "（退会したメンバー）"}さんが {formatLocalDate(info.schedule_updated_at)} に設定。メンバーなら誰でも直せます</span>
                )}
                {error && <span className="text-xs text-red-600">{error}</span>}
            </dd>
        </>
    )
}
