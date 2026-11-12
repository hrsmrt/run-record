"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
    ENTRY_DIFFICULTIES, ENTRY_DIFFICULTY_DESCRIPTIONS, ENTRY_METHODS, ENTRY_METHOD_LABELS,
    type EntryDifficulty, type EntryMethod,
} from "@/lib/event-info"

export type EntryInfoRow = {
    entry_method: EntryMethod | null
    entry_difficulty: EntryDifficulty | null
    updated_by_name: string | null
    updated_at: string | null
}

const formatLocalDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

// 大会詳細の「エントリー方式」「例年の難易度」。メンバーなら誰でも選び直せる（すぐ保存）
export function EventEntryInfoEditor({ eventId, info, canEdit, onChanged }: {
    eventId: number
    info: EntryInfoRow | null
    canEdit: boolean
    onChanged: () => void
}) {
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")
    const method = info?.entry_method ?? null
    const difficulty = info?.entry_difficulty ?? null

    const save = async (next: { method: EntryMethod | null; difficulty: EntryDifficulty | null }) => {
        setBusy(true)
        setError("")
        const { error } = await createClient().rpc("set_event_entry_info", { p_event_id: eventId, p_method: next.method, p_difficulty: next.difficulty })
        setBusy(false)
        if (error) { setError(`保存に失敗しました: ${error.message}`); return }
        onChanged()
    }

    const select = "border rounded px-1 py-0.5 bg-white text-sm disabled:opacity-50"
    return (
        <>
            <dt className="text-gray-500">エントリー</dt>
            <dd className="flex flex-col gap-0.5">
                {canEdit ? (
                    <span className="flex flex-wrap items-center gap-2">
                        <select value={method ?? ""} disabled={busy} onChange={e => save({ method: (e.target.value || null) as EntryMethod | null, difficulty })} className={select} aria-label="エントリー方式">
                            <option value="">方式は未設定</option>
                            {ENTRY_METHODS.map(m => <option key={m} value={m}>{ENTRY_METHOD_LABELS[m]}</option>)}
                        </select>
                        <select value={difficulty ?? ""} disabled={busy} onChange={e => save({ method, difficulty: (e.target.value || null) as EntryDifficulty | null })} className={select} aria-label="例年の難易度">
                            <option value="">例年の難易度は未設定</option>
                            {ENTRY_DIFFICULTIES.map(d => <option key={d} value={d}>{ENTRY_DIFFICULTY_DESCRIPTIONS[d]}</option>)}
                        </select>
                    </span>
                ) : (
                    <span>
                        {method ? ENTRY_METHOD_LABELS[method] : "方式は未設定"}・{difficulty ? ENTRY_DIFFICULTY_DESCRIPTIONS[difficulty] : "例年の難易度は未設定"}
                    </span>
                )}
                {info?.updated_at && (
                    <span className="text-xs text-gray-500">{info.updated_by_name ?? "（退会したメンバー）"}さんが {formatLocalDate(info.updated_at)} に設定。メンバーなら誰でも直せます</span>
                )}
                {error && <span className="text-xs text-red-600">{error}</span>}
            </dd>
        </>
    )
}
