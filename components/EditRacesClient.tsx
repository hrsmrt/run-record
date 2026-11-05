"use client"

import { Fragment, useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUnsavedWarning } from "@/lib/use-unsaved-warning"
import { RaceDivisionsEditor } from "@/components/RaceDivisionsEditor"

type EditionOption = {
    id: number
    held_on: string | null
    events: { name: string }
}

type Race = {
    id: number
    event_edition_id: number
    name: string
    distance_km: number
    time_limit_minutes: number | null
    elevation_gain_m: number | null
    entry_fee: number | null
    capacity: number | null
    entry_start_at: string | null
    entry_end_at: string | null
    entrants_total: number | null
    entrants_male: number | null
    entrants_female: number | null
}

type NewRace = Omit<Race, "id">

const editionLabel = (ed: EditionOption) => {
    const date = ed.held_on
        ? ` (${ed.held_on.substring(0, 4)}/${ed.held_on.substring(5, 7)}/${ed.held_on.substring(8, 10)})`
        : ""
    return `${ed.events.name}${date}`
}

// datetimelocal形式 ⇔ ISO文字列の変換（どちらもブラウザのタイムゾーン基準）
const pad = (n: number) => String(n).padStart(2, "0")
const toDatetimeLocal = (iso: string | null) => {
    if (!iso) return ""
    const d = new Date(iso)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const fromDatetimeLocal = (val: string) => val ? new Date(val).toISOString() : null

const PRESETS: { label: string; name: string; distance_km: number }[] = [
    { label: "フルマラソン",   name: "フルマラソン",   distance_km: 42.195   },
    { label: "ハーフマラソン", name: "ハーフマラソン", distance_km: 21.0975  },
    { label: "10km",           name: "10km",           distance_km: 10       },
    { label: "5km",            name: "5km",            distance_km: 5        },
    { label: "100km",          name: "100km",          distance_km: 100      },
    { label: "カスタム",       name: "",               distance_km: 0        },
]

export function EditRacesClient() {
    const [races, setRaces] = useState<Race[]>([])
    const [editions, setEditions] = useState<EditionOption[]>([])
    const [newRow, setNewRow] = useState<NewRace>({
        event_edition_id: 0, name: "フルマラソン", distance_km: 42.195,
        time_limit_minutes: null, elevation_gain_m: null,
        entry_fee: null, capacity: null,
        entry_start_at: null, entry_end_at: null,
        entrants_total: null, entrants_male: null, entrants_female: null,
    })
    const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set())
    // 「カスタム」を選んだ既存行（プリセットと一致していてもカスタム表示にする）
    const [customIds, setCustomIds] = useState<Set<number>>(new Set())
    const [newPreset, setNewPreset] = useState("フルマラソン")
    // 部門の編集欄を開いている種目
    const [openDivisionsId, setOpenDivisionsId] = useState<number | null>(null)
    const [editionSearch, setEditionSearch] = useState("")
    const [showDropdown, setShowDropdown] = useState(false)
    const [message, setMessage] = useState("")
    // 新規追加の結果はフォームの近くに出す
    const [addMessage, setAddMessage] = useState<{ text: string; isError: boolean } | null>(null)
    const searchRef = useRef<HTMLDivElement>(null)

    const supabase = createClient()

    useUnsavedWarning(dirtyIds.size > 0)

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node))
                setShowDropdown(false)
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    useEffect(() => {
        const fetch = async () => {
            const [{ data: raceData, error: raceError }, { data: edData, error: edError }] = await Promise.all([
                supabase.from("races").select("*").order("event_edition_id"),
                supabase.from("event_editions")
                    .select("id, held_on, events(name)")
                    .order("held_on", { ascending: false }),
            ])
            const error = raceError ?? edError
            if (error) { setMessage(`読み込みに失敗しました: ${error.message}`); return }
            setRaces(raceData ?? [])
            setEditions(edData as unknown as EditionOption[] ?? [])
        }
        fetch()
    }, [supabase])

    const handleSaveAll = async () => {
        const targets = races.filter(r => dirtyIds.has(r.id))
        if (targets.length === 0) { setMessage("変更はありません"); return }
        const errors: string[] = []
        const saved: number[] = []
        for (const r of targets) {
            const { error } = await supabase.from("races").update({
                event_edition_id: r.event_edition_id,
                name: r.name,
                distance_km: r.distance_km,
                time_limit_minutes: r.time_limit_minutes,
                elevation_gain_m: r.elevation_gain_m,
                entry_fee: r.entry_fee,
                capacity: r.capacity,
                entry_start_at: r.entry_start_at,
                entry_end_at: r.entry_end_at,
                entrants_total: r.entrants_total,
                entrants_male: r.entrants_male,
                entrants_female: r.entrants_female,
            }).eq("id", r.id)
            if (error) errors.push(`ID ${r.id}: ${error.message}`)
            else saved.push(r.id)
        }
        setDirtyIds(prev => new Set([...prev].filter(id => !saved.includes(id))))
        setMessage(errors.length > 0
            ? `${saved.length}件保存、${errors.length}件失敗: ${errors.join(", ")}`
            : `${saved.length}件保存しました`)
    }

    const handleDelete = async (id: number) => {
        if (!confirm("本当に削除しますか？")) return
        const { error } = await supabase.from("races").delete().eq("id", id)
        if (error) setMessage(`削除に失敗しました: ${error.message}`)
        else {
            setRaces(prev => prev.filter(r => r.id !== id))
            setDirtyIds(prev => { const next = new Set(prev); next.delete(id); return next })
            setMessage("削除しました")
        }
    }

    const handleAdd = async () => {
        if (!newRow.event_edition_id) { setAddMessage({ text: "開催回を選択してください", isError: true }); return }
        if (!newRow.name) { setAddMessage({ text: "種目名を入力してください", isError: true }); return }
        const { data, error } = await supabase.from("races").insert(newRow).select().single()
        if (error) { setAddMessage({ text: `追加に失敗しました: ${error.message}`, isError: true }); return }
        setRaces(prev => [...prev, data as Race])
        setNewRow({
            event_edition_id: 0, name: "フルマラソン", distance_km: 42.195,
            time_limit_minutes: null, elevation_gain_m: null,
            entry_fee: null, capacity: null,
            entry_start_at: null, entry_end_at: null,
            entrants_total: null, entrants_male: null, entrants_female: null,
        })
        setNewPreset("フルマラソン")
        setEditionSearch("")
        setAddMessage({ text: "追加しました", isError: false })
    }

    const update = <K extends keyof Race>(id: number, field: K, value: Race[K]) => {
        setRaces(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
        setDirtyIds(prev => new Set(prev).add(id))
    }

    const setCustom = (id: number, custom: boolean) => {
        setCustomIds(prev => {
            const next = new Set(prev)
            if (custom) next.add(id)
            else next.delete(id)
            return next
        })
    }

    return (
        <div className="max-w-6xl mx-auto p-4">
            <button onClick={handleSaveAll} className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                変更を保存{dirtyIds.size > 0 && `（${dirtyIds.size}件）`}
            </button>
            {message && <p className="mb-2 text-sm">{message}</p>}

            <div className="overflow-x-auto">
                <table className="table-auto text-left border-collapse text-sm whitespace-nowrap">
                    <thead>
                        <tr className="border-b">
                            <th className="px-2 py-1">開催回</th>
                            <th className="px-2 py-1">種目</th>
                            <th className="px-2 py-1">種目名</th>
                            <th className="px-2 py-1">距離(km)</th>
                            <th className="px-2 py-1">制限時間(分)</th>
                            <th className="px-2 py-1">高低差(m)</th>
                            <th className="px-2 py-1">参加費(円)</th>
                            <th className="px-2 py-1">定員</th>
                            <th className="px-2 py-1">エントリー開始</th>
                            <th className="px-2 py-1">エントリー終了</th>
                            <th className="px-2 py-1">エントリー数</th>
                            <th className="px-2 py-1">男子</th>
                            <th className="px-2 py-1">女子</th>
                            <th className="px-2 py-1">部門</th>
                            <th className="px-2 py-1">削除</th>
                        </tr>
                    </thead>
                    <tbody>
                        {races.map(r => (
                            <Fragment key={r.id}>
                            <tr className={`border-b ${dirtyIds.has(r.id) ? "bg-yellow-50" : ""}`}>
                                <td className="px-2 py-1">
                                    <select
                                        value={r.event_edition_id}
                                        onChange={e => update(r.id, "event_edition_id", Number(e.target.value))}
                                        className="px-1 border rounded"
                                    >
                                        {editions.map(ed => (
                                            <option key={ed.id} value={ed.id}>{editionLabel(ed)}</option>
                                        ))}
                                    </select>
                                </td>
                                <td className="px-2 py-1">
                                    <select
                                        className="px-1 border rounded"
                                        value={customIds.has(r.id)
                                            ? "カスタム"
                                            : PRESETS.find(p => p.name === r.name && p.distance_km === r.distance_km)?.label ?? "カスタム"}
                                        onChange={e => {
                                            const p = PRESETS.find(p => p.label === e.target.value)
                                            if (!p) return
                                            if (p.label === "カスタム") {
                                                setCustom(r.id, true)
                                            } else {
                                                setCustom(r.id, false)
                                                update(r.id, "name", p.name)
                                                update(r.id, "distance_km", p.distance_km)
                                            }
                                        }}
                                    >
                                        {PRESETS.map(p => <option key={p.label}>{p.label}</option>)}
                                    </select>
                                </td>
                                <td className="px-2 py-1">
                                    <input className="w-28 px-1 border rounded" value={r.name}
                                        onChange={e => update(r.id, "name", e.target.value)} />
                                </td>
                                <td className="px-2 py-1">
                                    <input type="number" className="w-20 px-1 border rounded" value={r.distance_km}
                                        onChange={e => update(r.id, "distance_km", Number(e.target.value))} />
                                </td>
                                <td className="px-2 py-1">
                                    <input type="number" className="w-20 px-1 border rounded" value={r.time_limit_minutes ?? ""}
                                        onChange={e => update(r.id, "time_limit_minutes", e.target.value === "" ? null : Number(e.target.value))} />
                                </td>
                                <td className="px-2 py-1">
                                    <input type="number" className="w-20 px-1 border rounded" value={r.elevation_gain_m ?? ""}
                                        onChange={e => update(r.id, "elevation_gain_m", e.target.value === "" ? null : Number(e.target.value))} />
                                </td>
                                <td className="px-2 py-1">
                                    <input type="number" className="w-24 px-1 border rounded" value={r.entry_fee ?? ""}
                                        onChange={e => update(r.id, "entry_fee", e.target.value === "" ? null : Number(e.target.value))} />
                                </td>
                                <td className="px-2 py-1">
                                    <input type="number" className="w-20 px-1 border rounded" value={r.capacity ?? ""}
                                        onChange={e => update(r.id, "capacity", e.target.value === "" ? null : Number(e.target.value))} />
                                </td>
                                <td className="px-2 py-1">
                                    <input type="datetime-local" className="px-1 border rounded"
                                        value={toDatetimeLocal(r.entry_start_at)}
                                        onChange={e => update(r.id, "entry_start_at", fromDatetimeLocal(e.target.value))} />
                                </td>
                                <td className="px-2 py-1">
                                    <input type="datetime-local" className="px-1 border rounded"
                                        value={toDatetimeLocal(r.entry_end_at)}
                                        onChange={e => update(r.id, "entry_end_at", fromDatetimeLocal(e.target.value))} />
                                </td>
                                {(["entrants_total", "entrants_male", "entrants_female"] as const).map(f => (
                                    <td key={f} className="px-2 py-1">
                                        <input type="number" min={1} className="w-20 px-1 border rounded" value={r[f] ?? ""}
                                            onChange={e => update(r.id, f, e.target.value === "" ? null : Number(e.target.value))} />
                                    </td>
                                ))}
                                <td className="px-2 py-1">
                                    <button
                                        onClick={() => setOpenDivisionsId(openDivisionsId === r.id ? null : r.id)}
                                        aria-expanded={openDivisionsId === r.id}
                                        className="text-blue-600 hover:underline"
                                    >
                                        {openDivisionsId === r.id ? "閉じる" : "編集"}
                                    </button>
                                </td>
                                <td className="px-2 py-1">
                                    <button onClick={() => handleDelete(r.id)}
                                        className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700">
                                        削除
                                    </button>
                                </td>
                            </tr>
                            {openDivisionsId === r.id && (
                                <tr className="border-b bg-gray-50">
                                    <td colSpan={16} className="px-2 py-2">
                                        <p className="text-xs font-semibold mb-1">部門ごとのエントリー数（保存は行ごと）</p>
                                        <RaceDivisionsEditor raceId={r.id} />
                                    </td>
                                </tr>
                            )}
                            </Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 新規追加フォーム */}
            <div className="mt-4 border-t-2 pt-4">
                <p className="text-sm font-semibold mb-2">新規追加</p>
                <div className="flex flex-wrap gap-2 items-end">
                    <div ref={searchRef} className="relative">
                        <label className="text-xs text-gray-500 block mb-1">開催回</label>
                        <input
                            type="text"
                            className="px-1 border rounded text-sm w-52"
                            placeholder="大会名で検索..."
                            value={editionSearch}
                            onChange={e => { setEditionSearch(e.target.value); setNewRow(prev => ({ ...prev, event_edition_id: 0 })); setShowDropdown(true) }}
                            onFocus={() => setShowDropdown(true)}
                        />
                        {showDropdown && (
                            <ul className="absolute z-10 bg-white border rounded shadow w-full max-h-48 overflow-y-auto text-sm">
                                {editions
                                    .filter(ed => editionLabel(ed).includes(editionSearch))
                                    .map(ed => (
                                        <li key={ed.id}
                                            className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                                            onMouseDown={() => {
                                                setNewRow(prev => ({ ...prev, event_edition_id: ed.id }))
                                                setEditionSearch(editionLabel(ed))
                                                setShowDropdown(false)
                                            }}>
                                            {editionLabel(ed)}
                                        </li>
                                    ))
                                }
                            </ul>
                        )}
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">種目</label>
                        <select
                            className="px-1 border rounded text-sm"
                            value={newPreset}
                            onChange={e => {
                                setNewPreset(e.target.value)
                                const p = PRESETS.find(p => p.label === e.target.value)
                                if (p && p.label !== "カスタム") {
                                    setNewRow(prev => ({ ...prev, name: p.name, distance_km: p.distance_km }))
                                }
                            }}
                        >
                            {PRESETS.map(p => <option key={p.label}>{p.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">種目名</label>
                        <input className="w-28 px-1 border rounded text-sm" value={newRow.name}
                            onChange={e => setNewRow(prev => ({ ...prev, name: e.target.value }))} />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">距離(km)</label>
                        <input type="number" className="w-20 px-1 border rounded text-sm" value={newRow.distance_km}
                            onChange={e => setNewRow(prev => ({ ...prev, distance_km: Number(e.target.value) }))} />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">制限時間(分)</label>
                        <input type="number" className="w-20 px-1 border rounded text-sm" value={newRow.time_limit_minutes ?? ""}
                            onChange={e => setNewRow(prev => ({ ...prev, time_limit_minutes: e.target.value === "" ? null : Number(e.target.value) }))} />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">高低差(m)</label>
                        <input type="number" className="w-20 px-1 border rounded text-sm" value={newRow.elevation_gain_m ?? ""}
                            onChange={e => setNewRow(prev => ({ ...prev, elevation_gain_m: e.target.value === "" ? null : Number(e.target.value) }))} />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">参加費(円)</label>
                        <input type="number" className="w-24 px-1 border rounded text-sm" value={newRow.entry_fee ?? ""}
                            onChange={e => setNewRow(prev => ({ ...prev, entry_fee: e.target.value === "" ? null : Number(e.target.value) }))} />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">定員</label>
                        <input type="number" className="w-20 px-1 border rounded text-sm" value={newRow.capacity ?? ""}
                            onChange={e => setNewRow(prev => ({ ...prev, capacity: e.target.value === "" ? null : Number(e.target.value) }))} />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">エントリー開始</label>
                        <input type="datetime-local" className="px-1 border rounded text-sm"
                            value={toDatetimeLocal(newRow.entry_start_at)}
                            onChange={e => setNewRow(prev => ({ ...prev, entry_start_at: fromDatetimeLocal(e.target.value) }))} />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">エントリー終了</label>
                        <input type="datetime-local" className="px-1 border rounded text-sm"
                            value={toDatetimeLocal(newRow.entry_end_at)}
                            onChange={e => setNewRow(prev => ({ ...prev, entry_end_at: fromDatetimeLocal(e.target.value) }))} />
                    </div>
                    {([["entrants_total", "エントリー数"], ["entrants_male", "男子"], ["entrants_female", "女子"]] as const).map(([f, label]) => (
                        <div key={f}>
                            <label className="text-xs text-gray-500 block mb-1">{label}</label>
                            <input type="number" min={1} className="w-20 px-1 border rounded text-sm" value={newRow[f] ?? ""}
                                onChange={e => setNewRow(prev => ({ ...prev, [f]: e.target.value === "" ? null : Number(e.target.value) }))} />
                        </div>
                    ))}
                    <button onClick={handleAdd}
                        className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm">
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
