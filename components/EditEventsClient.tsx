"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { PREFECTURE_ORDER, compareByPrefecture } from "@/lib/prefectures"
import { useUnsavedWarning } from "@/lib/use-unsaved-warning"
import { AdminEventFilterNote } from "@/components/AdminEventFilterNote"

type Event = {
    id: number
    name: string
    url: string | null
    type: string
    prefecture: string | null
}

type NewEvent = Omit<Event, "id">

// onlyEventId: その大会の行だけ出す（大会詳細の管理者メニューから）
export function EditEventsClient({ onlyEventId }: { onlyEventId?: number }) {
    const [events, setEvents] = useState<Event[]>([])
    const [newRow, setNewRow] = useState<NewEvent>({ name: "", url: null, type: "", prefecture: null })
    const [message, setMessage] = useState("")
    // 新規追加の結果はフォームの近くに出す
    const [addMessage, setAddMessage] = useState<{ text: string; isError: boolean } | null>(null)
    const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set())

    const supabase = createClient()

    useUnsavedWarning(dirtyIds.size > 0)

    useEffect(() => {
        const fetch = async () => {
            const { data, error } = await supabase.from("events").select("*")
            if (error) { setMessage(`読み込みに失敗しました: ${error.message}`); return }
            setEvents((data ?? []).sort(compareByPrefecture))
        }
        fetch()
    }, [supabase])

    const handleSaveAll = async () => {
        const targets = events.filter(ev => dirtyIds.has(ev.id))
        if (targets.length === 0) { setMessage("変更はありません"); return }
        const errors: string[] = []
        const saved: number[] = []
        for (const ev of targets) {
            const { error } = await supabase
                .from("events")
                .update({ name: ev.name, url: ev.url || null, type: ev.type, prefecture: ev.prefecture || null })
                .eq("id", ev.id)
            if (error) errors.push(`ID ${ev.id}: ${error.message}`)
            else saved.push(ev.id)
        }
        setDirtyIds(prev => new Set([...prev].filter(id => !saved.includes(id))))
        setMessage(errors.length > 0
            ? `${saved.length}件保存、${errors.length}件失敗: ${errors.join(", ")}`
            : `${saved.length}件保存しました`)
    }

    const handleDelete = async (id: number) => {
        if (!confirm("本当に削除しますか？")) return
        const { error } = await supabase.from("events").delete().eq("id", id)
        if (error) setMessage(`削除に失敗しました: ${error.message}`)
        else {
            setEvents(prev => prev.filter(e => e.id !== id))
            setDirtyIds(prev => { const next = new Set(prev); next.delete(id); return next })
            setMessage("削除しました")
        }
    }

    const handleAdd = async () => {
        if (!newRow.name) { setAddMessage({ text: "大会名を入力してください", isError: true }); return }
        if (!newRow.type) { setAddMessage({ text: "種別を入力してください", isError: true }); return }
        const { data, error } = await supabase
            .from("events")
            .insert({ name: newRow.name, url: newRow.url || null, type: newRow.type, prefecture: newRow.prefecture || null })
            .select()
            .single()
        if (error) { setAddMessage({ text: `追加に失敗しました: ${error.message}`, isError: true }); return }
        setEvents(prev => [...prev, data as Event].sort(compareByPrefecture))
        setNewRow({ name: "", url: null, type: "", prefecture: null })
        setAddMessage({ text: "追加しました", isError: false })
    }

    const update = (id: number, field: keyof Event, value: string | null) => {
        setEvents(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e))
        setDirtyIds(prev => new Set(prev).add(id))
    }

    return (
        <div className="max-w-4xl mx-auto p-4">
            <button onClick={handleSaveAll} className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                変更を保存{dirtyIds.size > 0 && `（${dirtyIds.size}件）`}
            </button>
            {message && <p className="mb-2 text-sm">{message}</p>}
            {onlyEventId != null && <AdminEventFilterNote eventId={onlyEventId} eventName={events.find(e => e.id === onlyEventId)?.name} basePath="/event/edit-events" />}

            <div className="overflow-x-auto">
                <table className="w-full table-auto text-left border-collapse text-sm">
                    <thead>
                        <tr className="border-b">
                            <th className="px-2 py-1">ID</th>
                            <th className="px-2 py-1">大会名</th>
                            <th className="px-2 py-1">URL</th>
                            <th className="px-2 py-1">種別</th>
                            <th className="px-2 py-1">県</th>
                            <th className="px-2 py-1">削除</th>
                        </tr>
                    </thead>
                    <tbody>
                        {events.filter(ev => onlyEventId == null || ev.id === onlyEventId).map(ev => (
                            <tr key={ev.id} className={`border-b ${dirtyIds.has(ev.id) ? "bg-yellow-50" : ""}`}>
                                <td className="px-2 py-1 text-xs text-gray-500">
                                    <a href={`/event/${ev.id}`} className="hover:underline">{ev.id}</a>
                                </td>
                                <td className="px-2 py-1">
                                    <input
                                        className="w-full px-1 border rounded"
                                        value={ev.name}
                                        onChange={e => update(ev.id, "name", e.target.value)}
                                    />
                                </td>
                                <td className="px-2 py-1">
                                    <input
                                        className="w-full px-1 border rounded"
                                        value={ev.url ?? ""}
                                        onChange={e => update(ev.id, "url", e.target.value || null)}
                                    />
                                </td>
                                <td className="px-2 py-1">
                                    <input
                                        className="w-32 px-1 border rounded"
                                        value={ev.type}
                                        onChange={e => update(ev.id, "type", e.target.value)}
                                    />
                                </td>
                                <td className="px-2 py-1">
                                    <PrefectureSelect
                                        className="w-24 px-1 border rounded"
                                        value={ev.prefecture}
                                        onChange={v => update(ev.id, "prefecture", v)}
                                    />
                                </td>
                                <td className="px-2 py-1">
                                    <button
                                        onClick={() => handleDelete(ev.id)}
                                        className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                                    >
                                        削除
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 新規追加フォーム */}
            <div className="mt-4 border-t-2 pt-4">
                <p className="text-sm font-semibold mb-2">新規追加</p>
                <div className="flex flex-wrap gap-2 items-end">
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">大会名</label>
                        <input
                            className="px-1 border rounded text-sm"
                            value={newRow.name}
                            onChange={e => setNewRow(prev => ({ ...prev, name: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">URL</label>
                        <input
                            className="px-1 border rounded text-sm w-64"
                            value={newRow.url ?? ""}
                            onChange={e => setNewRow(prev => ({ ...prev, url: e.target.value || null }))}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">種別</label>
                        <input
                            className="w-32 px-1 border rounded text-sm"
                            value={newRow.type}
                            onChange={e => setNewRow(prev => ({ ...prev, type: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">県</label>
                        <PrefectureSelect
                            className="w-24 px-1 border rounded text-sm"
                            value={newRow.prefecture}
                            onChange={v => setNewRow(prev => ({ ...prev, prefecture: v }))}
                        />
                    </div>
                    <button
                        onClick={handleAdd}
                        className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    >
                        追加
                    </button>
                </div>
                {addMessage && (
                    <p className={`mt-2 text-sm ${addMessage.isError ? "text-red-600" : "text-green-700"}`}>
                        {addMessage.text}
                    </p>
                )}
            </div>
        </div>
    )
}

// 一覧にない既存値（「東京」など）も選択肢に残して消えないようにする
function PrefectureSelect({ value, onChange, className }: {
    value: string | null
    onChange: (value: string | null) => void
    className?: string
}) {
    const options = value && !PREFECTURE_ORDER.includes(value) ? [value, ...PREFECTURE_ORDER] : PREFECTURE_ORDER
    return (
        <select className={className} value={value ?? ""} onChange={e => onChange(e.target.value || null)}>
            <option value="">未設定</option>
            {options.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
    )
}
