"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUnsavedWarning } from "@/lib/use-unsaved-warning"
import { AdminEventFilterNote } from "@/components/AdminEventFilterNote"

type Event = {
    id: number
    name: string
}

type EventEdition = {
    id: number
    event_id: number
    edition_number: number | null
    held_on: string | null
    // 当時の大会名（改名した大会の昔の回だけ。空なら大会の名前と同じ）
    name: string | null
}

type NewEdition = Omit<EventEdition, "id">

// onlyEventId: その大会の開催回だけ出し、追加の大会もその大会にしておく（大会詳細の管理者メニューから）
export function EditEventEditionsClient({ onlyEventId }: { onlyEventId?: number }) {
    const [editions, setEditions] = useState<EventEdition[]>([])
    const [events, setEvents] = useState<Event[]>([])
    const [newRow, setNewRow] = useState<NewEdition>({ event_id: onlyEventId ?? 0, edition_number: null, held_on: null, name: null })
    const [message, setMessage] = useState("")
    // 新規追加の結果はフォームの近くに出す
    const [addMessage, setAddMessage] = useState<{ text: string; isError: boolean } | null>(null)
    const [eventSearch, setEventSearch] = useState("")
    const [showDropdown, setShowDropdown] = useState(false)
    const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set())
    const searchRef = useRef<HTMLDivElement>(null)

    useUnsavedWarning(dirtyIds.size > 0)

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowDropdown(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const supabase = createClient()

    useEffect(() => {
        const fetch = async () => {
            const [{ data: edData, error: edError }, { data: evData, error: evError }] = await Promise.all([
                supabase.from("event_editions").select("*").order("held_on", { ascending: true }),
                supabase.from("events").select("id, name").order("name", { ascending: true }),
            ])
            const error = edError ?? evError
            if (error) { setMessage(`読み込みに失敗しました: ${error.message}`); return }
            setEditions(edData ?? [])
            setEvents(evData ?? [])
            if (onlyEventId != null) setEventSearch((evData ?? []).find(ev => ev.id === onlyEventId)?.name ?? "")
        }
        fetch()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [supabase])

    const handleSaveAll = async () => {
        const targets = editions.filter(ed => dirtyIds.has(ed.id))
        if (targets.length === 0) { setMessage("変更はありません"); return }
        const errors: string[] = []
        const saved: number[] = []
        for (const ed of targets) {
            const { error } = await supabase
                .from("event_editions")
                .update({
                    event_id: ed.event_id,
                    edition_number: ed.edition_number,
                    held_on: ed.held_on || null,
                    name: ed.name?.trim() || null,
                })
                .eq("id", ed.id)
            if (error) errors.push(`ID ${ed.id}: ${error.message}`)
            else saved.push(ed.id)
        }
        setDirtyIds(prev => new Set([...prev].filter(id => !saved.includes(id))))
        setMessage(errors.length > 0
            ? `${saved.length}件保存、${errors.length}件失敗: ${errors.join(", ")}`
            : `${saved.length}件保存しました`)
    }

    const handleDelete = async (id: number) => {
        // races は ON DELETE CASCADE なので、巻き添えで消える件数を事前に伝える
        const { count, error: countError } = await supabase
            .from("races")
            .select("id", { count: "exact", head: true })
            .eq("event_edition_id", id)
        if (countError) { setMessage(`種目数の取得に失敗しました: ${countError.message}`); return }
        const warning = count ? `この開催回の種目${count}件も一緒に削除されます。\n` : ""
        if (!confirm(`${warning}本当に削除しますか？`)) return
        const { error } = await supabase.from("event_editions").delete().eq("id", id)
        if (error) setMessage(`削除に失敗しました: ${error.message}`)
        else {
            setEditions(prev => prev.filter(e => e.id !== id))
            setDirtyIds(prev => { const next = new Set(prev); next.delete(id); return next })
            setMessage("削除しました")
        }
    }

    const handleAdd = async () => {
        if (!newRow.event_id) { setAddMessage({ text: "大会を選択してください", isError: true }); return }
        const { data, error } = await supabase
            .from("event_editions")
            .insert({
                event_id: newRow.event_id,
                edition_number: newRow.edition_number,
                held_on: newRow.held_on || null,
                name: newRow.name?.trim() || null,
            })
            .select()
            .single()
        if (error) { setAddMessage({ text: `追加に失敗しました: ${error.message}`, isError: true }); return }
        setEditions(prev => [...prev, data as EventEdition].sort((a, b) => {
            if (!a.held_on) return 1
            if (!b.held_on) return -1
            return a.held_on.localeCompare(b.held_on)
        }))
        setNewRow({ event_id: onlyEventId ?? 0, edition_number: null, held_on: null, name: null })
        setEventSearch(onlyEventId != null ? events.find(ev => ev.id === onlyEventId)?.name ?? "" : "")
        setAddMessage({ text: "追加しました", isError: false })
    }

    const update = (id: number, field: keyof EventEdition, value: string | number | null) => {
        setEditions(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e))
        setDirtyIds(prev => new Set(prev).add(id))
    }

    return (
        <div className="max-w-3xl mx-auto p-4">
            <button onClick={handleSaveAll} className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                変更を保存{dirtyIds.size > 0 && `（${dirtyIds.size}件）`}
            </button>
            {message && <p className="mb-2 text-sm">{message}</p>}
            {onlyEventId != null && <AdminEventFilterNote eventId={onlyEventId} eventName={events.find(e => e.id === onlyEventId)?.name} basePath="/event/edit-editions" />}

            <div className="overflow-x-auto">
                <table className="w-full table-auto text-left border-collapse text-sm">
                    <thead>
                        <tr className="border-b">
                            <th className="px-2 py-1">ID</th>
                            <th className="px-2 py-1">大会名</th>
                            <th className="px-2 py-1">回数</th>
                            <th className="px-2 py-1">開催日</th>
                            <th className="px-2 py-1">当時の大会名 <span className="text-xs font-normal text-gray-500">（改名前の回だけ）</span></th>
                            <th className="px-2 py-1">削除</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* 絞り込み中に別の大会へ付け替えた行も、保存するまでは出しておく */}
                        {editions.filter(ed => onlyEventId == null || ed.event_id === onlyEventId || dirtyIds.has(ed.id)).map(ed => (
                            <tr key={ed.id} className={`border-b ${dirtyIds.has(ed.id) ? "bg-yellow-50" : ""}`}>
                                <td className="px-2 py-1 text-xs text-gray-500">{ed.id}</td>
                                <td className="px-2 py-1">
                                    <select
                                        value={ed.event_id}
                                        onChange={e => update(ed.id, "event_id", Number(e.target.value))}
                                        className="w-full px-1 border rounded"
                                    >
                                        {events.map(ev => (
                                            <option key={ev.id} value={ev.id}>{ev.name}</option>
                                        ))}
                                    </select>
                                </td>
                                <td className="px-2 py-1">
                                    <input
                                        type="number"
                                        className="w-16 px-1 border rounded"
                                        value={ed.edition_number ?? ""}
                                        onChange={e => update(ed.id, "edition_number", e.target.value === "" ? null : Number(e.target.value))}
                                    />
                                </td>
                                <td className="px-2 py-1">
                                    <input
                                        type="date"
                                        className="px-1 border rounded"
                                        value={ed.held_on ?? ""}
                                        onChange={e => update(ed.id, "held_on", e.target.value || null)}
                                    />
                                </td>
                                <td className="px-2 py-1">
                                    <input
                                        className="w-48 px-1 border rounded"
                                        maxLength={100}
                                        value={ed.name ?? ""}
                                        placeholder="大会の名前と同じ"
                                        onChange={e => update(ed.id, "name", e.target.value || null)}
                                    />
                                </td>
                                <td className="px-2 py-1">
                                    <button
                                        onClick={() => handleDelete(ed.id)}
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

            {/* 新規追加フォーム（テーブル外に配置してドロップダウンのクリップを回避） */}
            <div className="mt-4 border-t-2 pt-4">
                <p className="text-sm font-semibold mb-2">新規追加</p>
                <div className="flex flex-wrap gap-2 items-end">
                    <div ref={searchRef} className="relative">
                        <label className="text-xs text-gray-500 block mb-1">大会名</label>
                        <input
                            type="text"
                            className="px-1 border rounded text-sm"
                            placeholder="大会名で検索..."
                            value={eventSearch}
                            onChange={e => { setEventSearch(e.target.value); setNewRow(prev => ({ ...prev, event_id: 0 })); setShowDropdown(true) }}
                            onFocus={() => setShowDropdown(true)}
                        />
                        {showDropdown && (
                            <ul className="absolute z-10 bg-white border rounded shadow w-full max-h-48 overflow-y-auto text-sm">
                                {events
                                    .filter(ev => ev.name.includes(eventSearch))
                                    .map(ev => (
                                        <li
                                            key={ev.id}
                                            className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                                            onMouseDown={() => {
                                                setNewRow(prev => ({ ...prev, event_id: ev.id }))
                                                setEventSearch(ev.name)
                                                setShowDropdown(false)
                                            }}
                                        >
                                            {ev.name}
                                        </li>
                                    ))
                                }
                            </ul>
                        )}
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">回数</label>
                        <input
                            type="number"
                            className="w-16 px-1 border rounded text-sm"
                            value={newRow.edition_number ?? ""}
                            onChange={e => setNewRow(prev => ({ ...prev, edition_number: e.target.value === "" ? null : Number(e.target.value) }))}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">開催日</label>
                        <input
                            type="date"
                            className="px-1 border rounded text-sm"
                            value={newRow.held_on ?? ""}
                            onChange={e => setNewRow(prev => ({ ...prev, held_on: e.target.value || null }))}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">当時の大会名（改名前の回だけ）</label>
                        <input
                            className="w-48 px-1 border rounded text-sm"
                            maxLength={100}
                            value={newRow.name ?? ""}
                            placeholder="大会の名前と同じ"
                            onChange={e => setNewRow(prev => ({ ...prev, name: e.target.value || null }))}
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
