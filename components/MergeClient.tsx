"use client"

import { useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { type CatalogEdition, type CatalogEvent, type CatalogRace, normalizeEventName, useCatalog } from "@/components/RacePicker"
import { formatDistance } from "@/lib/splits"

type Kind = "event" | "edition" | "race"
const KIND_LABELS: Record<Kind, string> = { event: "大会", edition: "開催回", race: "種目" }
type Preview = { editions: number; races: number; results: number; reports: number; routes: number; organizers: number }

const formatDate = (d: string | null) => d ? `${d.substring(0, 4)}/${d.substring(5, 7)}/${d.substring(8, 10)}` : "開催日未定"

// 管理者: 重複した大会・開催回・種目を1つにまとめる。消す方に付いている記録などを残す方へ付け替えてから消す
export function MergeClient() {
    const { events, editions, races, error, reload } = useCatalog()
    // 大会をまとめるとき、消す方の名前を開催回の当時の名前として残す（改名した大会向け）
    const [keepOldName, setKeepOldName] = useState(true)
    const [kind, setKind] = useState<Kind>("event")
    const [eventId, setEventId] = useState<number | null>(null)
    const [editionId, setEditionId] = useState<number | null>(null)
    const [fromId, setFromId] = useState<number | null>(null)
    const [intoId, setIntoId] = useState<number | null>(null)
    const [preview, setPreview] = useState<Preview | null>(null)
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

    const eventName = (id: number) => events?.find(e => e.id === id)?.name ?? ""
    const editionLabel = (ed: CatalogEdition) => `${eventName(ed.event_id)} ${formatDate(ed.held_on)}${ed.edition_number != null ? ` 第${ed.edition_number}回` : ""}`
    const raceLabel = (r: CatalogRace) => `${r.name}（${formatDistance(r.distance_km)}）`

    // 重複の候補（大会は名前の表記ゆれ、開催回は同じ大会の同じ日、種目は同じ開催回の同じ距離）
    const candidates = useMemo(() => {
        const list: { kind: Kind; label: string; ids: number[]; eventId?: number; editionId?: number }[] = []
        const byName = new Map<string, CatalogEvent[]>()
        for (const e of events ?? []) {
            const k = normalizeEventName(e.name)
            byName.set(k, [...(byName.get(k) ?? []), e])
        }
        byName.forEach(g => { if (g.length > 1) list.push({ kind: "event", label: g.map(e => e.name).join(" / "), ids: g.map(e => e.id) }) })
        const byDate = new Map<string, CatalogEdition[]>()
        for (const ed of editions) if (ed.held_on) byDate.set(`${ed.event_id}|${ed.held_on}`, [...(byDate.get(`${ed.event_id}|${ed.held_on}`) ?? []), ed])
        byDate.forEach(g => { if (g.length > 1) list.push({ kind: "edition", label: editionLabel(g[0]), ids: g.map(e => e.id), eventId: g[0].event_id }) })
        const byDistance = new Map<string, CatalogRace[]>()
        for (const r of races) byDistance.set(`${r.event_edition_id}|${r.distance_km}`, [...(byDistance.get(`${r.event_edition_id}|${r.distance_km}`) ?? []), r])
        byDistance.forEach(g => {
            const ed = editions.find(e => e.id === g[0].event_edition_id)
            if (g.length > 1 && ed) list.push({ kind: "race", label: `${editionLabel(ed)} ${g.map(raceLabel).join(" / ")}`, ids: g.map(r => r.id), eventId: ed.event_id, editionId: ed.id })
        })
        return list
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [events, editions, races])

    const reset = (next: Partial<{ kind: Kind; eventId: number | null; editionId: number | null }>) => {
        if (next.kind !== undefined) setKind(next.kind)
        if (next.eventId !== undefined) setEventId(next.eventId)
        if (next.editionId !== undefined) setEditionId(next.editionId)
        setFromId(null)
        setIntoId(null)
        setPreview(null)
        setMessage(null)
    }

    const choices: { id: number; label: string }[] =
        kind === "event" ? [...(events ?? [])].sort((a, b) => a.name.localeCompare(b.name, "ja")).map(e => ({ id: e.id, label: `${e.name}（ID ${e.id}）` }))
        : kind === "edition" ? editions.filter(e => e.event_id === eventId).sort((a, b) => (b.held_on ?? "").localeCompare(a.held_on ?? "")).map(e => ({ id: e.id, label: `${editionLabel(e)}（ID ${e.id}）` }))
        : races.filter(r => r.event_edition_id === editionId).map(r => ({ id: r.id, label: `${raceLabel(r)}（ID ${r.id}）` }))

    // k は候補から選んだときの種類（setKind の反映を待たずに件数を取るため）
    const choose = async (from: number | null, into: number | null, k: Kind = kind) => {
        setFromId(from)
        setIntoId(into)
        setPreview(null)
        setMessage(null)
        if (from == null) return
        const { data, error } = await createClient().rpc("admin_merge_preview", { p_kind: k, p_from: from }).single()
        if (error) { setMessage({ text: `件数を取得できませんでした: ${error.message}`, isError: true }); return }
        setPreview(data as Preview)
    }

    const merge = async () => {
        if (fromId == null || intoId == null) return
        const fromLabel = choices.find(c => c.id === fromId)?.label
        const intoLabel = choices.find(c => c.id === intoId)?.label
        if (!confirm(`「${fromLabel}」を「${intoLabel}」にまとめ、「${fromLabel}」を削除します。元に戻せません。よろしいですか？`)) return
        setBusy(true)
        const fn = kind === "event" ? "admin_merge_events" : kind === "edition" ? "admin_merge_editions" : "admin_merge_races"
        const { error } = await createClient().rpc(fn, kind === "event"
            ? { p_from: fromId, p_into: intoId, p_keep_old_name: keepOldName }
            : { p_from: fromId, p_into: intoId })
        setBusy(false)
        if (error) { setMessage({ text: `まとめられませんでした: ${error.message}`, isError: true }); return }
        setMessage({ text: `まとめました（「${fromLabel}」は削除しました）`, isError: false })
        setFromId(null)
        setIntoId(null)
        setPreview(null)
        reload()
    }

    if (error) return <p className="px-4 text-sm text-red-600">読み込みに失敗しました: {error}</p>
    if (!events) return <p className="px-4 text-sm">読み込み中...</p>

    const select = "border rounded px-2 py-1 bg-white max-w-full"

    return (
        <div className="px-4 pb-8 max-w-4xl text-sm text-black flex flex-col gap-4">
            <section className="flex flex-col gap-1">
                <h2 className="font-bold">重複の候補</h2>
                {candidates.length === 0 && <p className="text-gray-500">見つかりませんでした。</p>}
                <ul className="flex flex-col gap-0.5">
                    {candidates.map((c, i) => (
                        <li key={i} className="flex flex-wrap items-center gap-2">
                            <span className="text-xs px-1 rounded bg-gray-100">{KIND_LABELS[c.kind]}</span>
                            <span>{c.label}</span>
                            <button
                                onClick={() => { reset({ kind: c.kind, eventId: c.eventId ?? null, editionId: c.editionId ?? null }); choose(c.ids[1], c.ids[0], c.kind) }}
                                className="text-xs text-blue-600 hover:underline"
                            >
                                まとめる
                            </button>
                        </li>
                    ))}
                </ul>
                <p className="text-xs text-gray-500">大会は名前の表記ゆれ（空白・第〇回・年・「大会」を除いて同じ）、開催回は同じ大会の同じ日、種目は同じ開催回の同じ距離を候補にしています。</p>
            </section>

            <section className="flex flex-col gap-2 bg-white border rounded p-3">
                <h2 className="font-bold">まとめる</h2>
                <div className="flex flex-wrap gap-3">
                    {(Object.keys(KIND_LABELS) as Kind[]).map(k => (
                        <label key={k} className="flex items-center gap-1">
                            <input type="radio" checked={kind === k} onChange={() => reset({ kind: k })} />
                            {KIND_LABELS[k]}
                        </label>
                    ))}
                </div>
                {kind !== "event" && (
                    <select value={eventId ?? ""} onChange={e => reset({ eventId: e.target.value ? Number(e.target.value) : null, editionId: null })} className={select} aria-label="大会">
                        <option value="">大会を選ぶ</option>
                        {[...events].sort((a, b) => a.name.localeCompare(b.name, "ja")).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                )}
                {kind === "race" && eventId != null && (
                    <select value={editionId ?? ""} onChange={e => reset({ editionId: e.target.value ? Number(e.target.value) : null })} className={select} aria-label="開催回">
                        <option value="">開催回を選ぶ</option>
                        {editions.filter(e => e.event_id === eventId).map(e => <option key={e.id} value={e.id}>{editionLabel(e)}</option>)}
                    </select>
                )}
                {(kind === "event" || (kind === "edition" && eventId != null) || (kind === "race" && editionId != null)) && (
                    <div className="flex flex-wrap items-center gap-2">
                        <select value={fromId ?? ""} onChange={e => choose(e.target.value ? Number(e.target.value) : null, intoId)} className={select} aria-label="消す方">
                            <option value="">消す方</option>
                            {choices.map(c => <option key={c.id} value={c.id} disabled={c.id === intoId}>{c.label}</option>)}
                        </select>
                        <span>を</span>
                        <select value={intoId ?? ""} onChange={e => setIntoId(e.target.value ? Number(e.target.value) : null)} className={select} aria-label="残す方">
                            <option value="">残す方</option>
                            {choices.map(c => <option key={c.id} value={c.id} disabled={c.id === fromId}>{c.label}</option>)}
                        </select>
                        <span>にまとめる</span>
                    </div>
                )}
                {kind === "event" && (
                    <label className="flex items-start gap-1">
                        <input type="checkbox" checked={keepOldName} onChange={e => setKeepOldName(e.target.checked)} className="mt-1" />
                        <span>
                            消す方の大会名を、移す開催回の「当時の大会名」として残す
                            <span className="block text-xs text-gray-500">大会が改名したときに使います。昔の回の記録は当時の名前で表示され、旧称でも検索できます。同じ名前の表記ゆれをまとめるときは外してください。</span>
                        </span>
                    </label>
                )}
                {preview && (
                    <p className="text-gray-700">
                        消す方に付いているもの: 開催回 {preview.editions}・種目 {preview.races}・記録 {preview.results}・大会レポート {preview.reports}・コース {preview.routes}・記録係 {preview.organizers}
                        （残す方へ付け替えます。同じ日の開催回・同じ距離と名前の種目は、さらにまとめます）
                    </p>
                )}
                <button onClick={merge} disabled={busy || fromId == null || intoId == null} className="self-start px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
                    {busy ? "まとめています..." : "まとめる（元に戻せません）"}
                </button>
                {message && <p className={message.isError ? "text-red-600" : "text-green-700"}>{message.text}</p>}
                <p className="text-xs text-gray-500">
                    同じ人の記録・大会レポートが両方にある、コースが両方にあるときは、まとめずに止まります（何も変わりません）。表示された人の分を片方消してから、もう一度まとめてください。
                    付け替えた記録は「記録の変更履歴」に残ります。
                </p>
            </section>
        </div>
    )
}
