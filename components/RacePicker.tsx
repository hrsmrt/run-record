"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { PREFECTURE_ORDER } from "@/lib/prefectures"
import { normalizeKana } from "@/lib/members"
import { formatDistance } from "@/lib/splits"
import type { RaceOption } from "@/components/RaceInput"

export type CatalogEvent = { id: number; name: string; type: string; prefecture: string | null }
// name: 当時の大会名（改名した大会の昔の回。NULL なら大会の名前と同じ）
export type CatalogEdition = { id: number; event_id: number; held_on: string | null; edition_number: number | null; name: string | null }
export type CatalogRace = { id: number; event_edition_id: number; name: string; distance_km: number }

// 最初の一覧に出す範囲（記録を登録するのはほとんどが終わったばかりの大会のため）
// ・登録済みの開催日: 2週間後〜半年前
// ・推定の候補（毎年の大会で今年の開催日が未登録）: 前回の開催日の52週後（同じ曜日）が2週間後〜2か月前のもの。
//   今年は去年より早い・遅いこともあるので、範囲を前後に取る
const RECENT_DAYS = 183
const AHEAD_DAYS = 14
const ESTIMATE_BACK_DAYS = 61
// 推定日の前後この日数に開催回があれば「今年の分は登録済み」とみなして推定を出さない
const SAME_CYCLE_DAYS = 45
const DAY_MS = 86400000
const WEEKS_52_MS = 364 * DAY_MS

const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

// 前回の開催日が今年から見て何年前か（推定の候補の表示用）
const yearsAgoLabel = (date: string) => {
    const diff = new Date().getFullYear() - Number(date.substring(0, 4))
    return diff === 1 ? "昨年" : diff === 2 ? "一昨年" : `${diff}年前`
}

const formatDate = (d: string) => `${d.substring(0, 4)}/${d.substring(5, 7)}/${d.substring(8, 10)}`

// 大会名の比較用: 空白・「第〇回」・年・「大会」を除き、ひらがな・カタカナをそろえる（表記の違いによる重複を見つけるため）
export const normalizeEventName = (s: string) =>
    normalizeKana(s).replace(/第?\d+回/g, "").replace(/(19|20)\d{2}年?/g, "").replace(/大会/g, "").replace(/[・･\-ー－()（）]/g, "")

const DISTANCE_PRESETS = [
    { label: "フル", km: 42.195, name: "フルマラソン" },
    { label: "ハーフ", km: 21.0975, name: "ハーフマラソン" },
    { label: "10km", km: 10, name: "10km" },
    { label: "5km", km: 5, name: "5km" },
]

// 大会・開催回・種目をまとめて読む（追加したら読み直す）
export function useCatalog() {
    const [events, setEvents] = useState<CatalogEvent[] | null>(null)
    const [editions, setEditions] = useState<CatalogEdition[]>([])
    const [races, setRaces] = useState<CatalogRace[]>([])
    const [error, setError] = useState("")
    const reload = useCallback(async () => {
        const supabase = createClient()
        const [ev, ed, ra] = await Promise.all([
            supabase.from("events").select("id, name, type, prefecture"),
            supabase.from("event_editions").select("id, event_id, held_on, edition_number, name"),
            supabase.from("races").select("id, event_edition_id, name, distance_km"),
        ])
        const err = ev.error ?? ed.error ?? ra.error
        if (err) { setError(err.message); return }
        setEvents((ev.data ?? []) as CatalogEvent[])
        setEditions((ed.data ?? []) as CatalogEdition[])
        setRaces(((ra.data ?? []) as CatalogRace[]).map(r => ({ ...r, distance_km: Number(r.distance_km) })))
    }, [])
    useEffect(() => { reload() }, [reload])
    return { events, editions, races, error, reload }
}

// 大会 → 開催日 → 種目の順に選ぶ。見つからなければその場で追加できる（メンバーなら誰でも。重複しそうなときは候補を出す）
export function RacePicker({ value, onChange, allowCreate = true }: {
    value: number | null
    onChange: (race: RaceOption | null) => void
    allowCreate?: boolean
}) {
    const { events, editions, races, error, reload } = useCatalog()
    const [eventId, setEventId] = useState<number | null>(null)
    const [editionId, setEditionId] = useState<number | null>(null)
    const [query, setQuery] = useState("")
    // 半年より前の大会も一覧に出す
    const [showAll, setShowAll] = useState(false)
    const [creating, setCreating] = useState<"event" | "edition" | "race" | null>(null)
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState("")
    // 追加フォーム
    const [newEvent, setNewEvent] = useState({ name: "", prefecture: "", type: "road", url: "" })
    const [newEdition, setNewEdition] = useState({ date: "", number: "" })
    const [newRace, setNewRace] = useState({ name: "", km: "" })

    // 選択済みの種目（value）から、大会・開催回をさかのぼって表示する
    useEffect(() => {
        if (value == null || !events) return
        const race = races.find(r => r.id === value)
        const edition = race && editions.find(e => e.id === race.event_edition_id)
        if (race && edition) { setEventId(edition.event_id); setEditionId(edition.id) }
    }, [value, events, races, editions])

    const event = events?.find(e => e.id === eventId) ?? null
    const edition = editions.find(e => e.id === editionId) ?? null
    const race = races.find(r => r.id === value) ?? null
    const eventTypes = useMemo(() => [...new Set(["road", "trail", ...(events ?? []).map(e => e.type).filter(Boolean)])], [events])

    // 大会の候補。検索していないときは上の範囲だけ（「すべての大会を表示」で全部）、日付の新しい順
    const today = isoDate(new Date())
    const aheadTo = isoDate(new Date(Date.now() + AHEAD_DAYS * DAY_MS))
    const recentFrom = isoDate(new Date(Date.now() - RECENT_DAYS * DAY_MS))
    const estimateFrom = isoDate(new Date(Date.now() - ESTIMATE_BACK_DAYS * DAY_MS))
    // 大会ごとの並べる日付: 登録済みで2週間後までの一番新しい開催日、なければ推定日
    const eventDates = useMemo(() => {
        const m = new Map<number, { date: string; estimated: boolean; from?: string }>()
        const byEvent = new Map<number, string[]>()
        for (const ed of editions) if (ed.held_on) byEvent.set(ed.event_id, [...(byEvent.get(ed.event_id) ?? []), ed.held_on])
        byEvent.forEach((dates, id) => {
            const real = dates.filter(d => d <= aheadTo).sort().at(-1)
            if (real) m.set(id, { date: real, estimated: false })
            // 前回の開催日から52週ずつ進め、推定の範囲に入れば候補（今年の分が登録済みなら出さない）
            const latest = dates.sort().at(-1)!
            let t = new Date(`${latest}T00:00:00`).getTime() + WEEKS_52_MS
            while (isoDate(new Date(t)) <= aheadTo) {
                const est = isoDate(new Date(t))
                const registered = dates.some(d => Math.abs(new Date(`${d}T00:00:00`).getTime() - t) <= SAME_CYCLE_DAYS * DAY_MS)
                if (est >= estimateFrom && !registered && (!real || est > real)) m.set(id, { date: est, estimated: true, from: latest })
                t += WEEKS_52_MS
            }
        })
        return m
    }, [editions, aheadTo, estimateFrom])
    // 大会ごとの旧称（開催回の当時の名前）。検索と「似た名前」の判定に含める
    const aliases = useMemo(() => {
        const m = new Map<number, string[]>()
        for (const ed of editions) if (ed.name && !(m.get(ed.event_id) ?? []).includes(ed.name)) m.set(ed.event_id, [...(m.get(ed.event_id) ?? []), ed.name])
        return m
    }, [editions])
    const searching = query.trim() !== ""
    const eventOptions = useMemo(() => {
        const q = normalizeKana(query)
        const inRange = (id: number) => {
            const d = eventDates.get(id)
            return !!d && (d.estimated ? d.date >= estimateFrom : d.date >= recentFrom)
        }
        return (events ?? [])
            .filter(e => searching
                ? [e.name, ...(aliases.get(e.id) ?? [])].some(n => normalizeKana(n).includes(q) || normalizeEventName(n).includes(normalizeEventName(query)))
                : showAll || inRange(e.id))
            .sort((a, b) => (eventDates.get(b.id)?.date ?? "").localeCompare(eventDates.get(a.id)?.date ?? "") || a.name.localeCompare(b.name, "ja"))
            .slice(0, showAll && !searching ? 300 : 50)
    }, [events, query, searching, showAll, eventDates, recentFrom, estimateFrom, aliases])
    // 選んだ大会の推定日（今年の開催日が未登録のとき）
    const estimate = eventId != null && eventDates.get(eventId)?.estimated ? eventDates.get(eventId)! : null
    // 追加しようとしている大会名に似た既存の大会
    const similarEvents = useMemo(() => {
        const n = normalizeEventName(newEvent.name)
        if (n.length < 2) return []
        return (events ?? []).filter(e => [e.name, ...(aliases.get(e.id) ?? [])].some(name => {
            const m = normalizeEventName(name)
            return m.includes(n) || n.includes(m)
        })).slice(0, 5)
    }, [events, newEvent.name, aliases])

    // 開催日: 今日までの日付を近い順に先に、その後ろにこれから先の日付（近い順）、開催日未定は最後
    const editionOptions = editions.filter(e => e.event_id === eventId).sort((a, b) => {
        const rank = (d: string | null) => d == null ? 2 : d <= today ? 0 : 1
        const ra = rank(a.held_on), rb = rank(b.held_on)
        if (ra !== rb) return ra - rb
        if (ra === 0) return b.held_on!.localeCompare(a.held_on!)
        return (a.held_on ?? "").localeCompare(b.held_on ?? "")
    })
    const raceOptions = races.filter(r => r.event_edition_id === editionId).sort((a, b) => b.distance_km - a.distance_km)

    const emit = (r: CatalogRace | null, ed = edition, ev = event) => {
        if (!r || !ed || !ev) { onChange(null); return }
        onChange({
            // 記録の大会名は、その回の当時の名前（改名前の回なら旧称）
            id: r.id, editionId: ed.id, eventName: ed.name ?? ev.name, eventType: ev.type, heldOn: ed.held_on, distanceKm: r.distance_km,
            label: `${ed.name ?? ev.name} ${ed.held_on ? formatDate(ed.held_on) : "開催日未定"} ${r.name}`,
        })
    }

    const chooseEvent = (id: number | null) => { setEventId(id); setEditionId(null); setCreating(null); setMessage(""); emit(null) }
    const chooseEdition = (id: number | null) => { setEditionId(id); setCreating(null); setMessage(""); emit(null) }

    // 追加（DB の一意の制約に当たったときは分かりやすく伝える）
    const run = async <T,>(insert: () => PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>, dupText: string) => {
        setBusy(true)
        setMessage("")
        const { data, error } = await insert()
        setBusy(false)
        if (error) { setMessage(error.code === "23505" ? dupText : `追加に失敗しました: ${error.message}`); return null }
        await reload()
        setCreating(null)
        return data
    }

    const addEvent = async () => {
        if (newEvent.name.trim() === "") { setMessage("大会名を入力してください"); return }
        const data = await run(() => createClient().from("events")
            .insert({ name: newEvent.name.trim(), prefecture: newEvent.prefecture || null, type: newEvent.type, url: newEvent.url.trim() || null })
            .select("id").single(), "同じ大会がすでにあります")
        if (data) { chooseEvent((data as { id: number }).id); setNewEvent({ name: "", prefecture: "", type: "road", url: "" }) }
    }
    const addEdition = async () => {
        if (!eventId || !newEdition.date) { setMessage("開催日を入力してください"); return }
        const number = newEdition.number.trim() === "" ? null : Number(newEdition.number)
        if (number != null && (!Number.isInteger(number) || number <= 0)) { setMessage("第〇回は正の整数で入力してください"); return }
        const data = await run(() => createClient().from("event_editions")
            .insert({ event_id: eventId, held_on: newEdition.date, edition_number: number })
            .select("id").single(), "この大会のその開催日はすでに登録されています")
        if (data) { chooseEdition((data as { id: number }).id); setNewEdition({ date: "", number: "" }) }
    }
    const addRace = async () => {
        const km = Number(newRace.km)
        if (!editionId || newRace.name.trim() === "") { setMessage("種目名を入力してください"); return }
        if (!Number.isFinite(km) || km <= 0) { setMessage("距離は km の数値で入力してください"); return }
        const data = await run(() => createClient().from("races")
            .insert({ event_edition_id: editionId, name: newRace.name.trim(), distance_km: km })
            .select("id, event_edition_id, name, distance_km").single(), "この開催回に同じ距離・同じ名前の種目がすでにあります")
        if (data) {
            const r = data as CatalogRace
            emit({ ...r, distance_km: Number(r.distance_km) })
            setNewRace({ name: "", km: "" })
        }
    }

    if (error) return <p className="text-sm text-red-600">大会情報の読み込みに失敗しました: {error}</p>
    if (!events) return <p className="text-sm">読み込み中...</p>

    const input = "border rounded px-2 py-1 bg-white"
    const chip = (active: boolean) => `px-2 py-1 rounded border text-sm ${active ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-gray-50"}`
    const addLink = "text-xs text-blue-600 hover:underline"

    return (
        <div className="flex flex-col gap-3 text-sm">
            {/* 1. 大会 */}
            <div className="flex flex-col gap-1">
                <span className="font-semibold">大会</span>
                {event ? (
                    <div className="flex items-center gap-2">
                        <span className="font-bold">{event.name}</span>
                        {event.prefecture && <span className="text-xs text-gray-500">{event.prefecture}</span>}
                        <button type="button" onClick={() => chooseEvent(null)} className={addLink}>変更</button>
                    </div>
                ) : (
                    <>
                        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="大会名で検索（例: 東京）" className={`${input} w-72 max-w-full`} />
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>{searching ? "すべての大会から検索しています" : showAll ? "すべての大会（日付の新しい順）" : "最近開催された大会と、今年の開催日がまだ登録されていない毎年の大会（オレンジは前回の開催日。日付の新しい順）"}</span>
                            {!searching && (
                                <button type="button" onClick={() => setShowAll(v => !v)} className="text-blue-600 hover:underline">
                                    {showAll ? "最近の大会だけにする" : "すべての大会を表示"}
                                </button>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto">
                            {eventOptions.map(e => (
                                <button key={e.id} type="button" onClick={() => chooseEvent(e.id)} className={chip(false)}>
                                    {e.name}
                                    {aliases.has(e.id) && <span className="ml-1 text-xs opacity-75">（旧称: {aliases.get(e.id)!.join("・")}）</span>}
                                    {eventDates.has(e.id) && (() => {
                                        // 推定の候補は、推定日ではなく前回の実際の開催日を「（昨年）」付きで出す
                                        const d = eventDates.get(e.id)!
                                        return d.estimated
                                            ? <span className="ml-1 text-xs text-orange-600">{formatDate(d.from!)}（{yearsAgoLabel(d.from!)}）</span>
                                            : <span className="ml-1 text-xs text-gray-500">{formatDate(d.date)}</span>
                                    })()}
                                    {e.prefecture && <span className="ml-1 text-xs text-gray-500">{e.prefecture}</span>}
                                </button>
                            ))}
                            {eventOptions.length === 0 && (
                                <span className="text-gray-500">{searching ? "該当する大会がありません" : "最近の大会はありません。大会名で検索してください"}</span>
                            )}
                        </div>
                        {allowCreate && creating !== "event" && (
                            <button type="button" onClick={() => { setCreating("event"); setNewEvent(v => ({ ...v, name: query })) }} className={`${addLink} self-start`}>
                                ＋ 見つからないときは、新しい大会を追加
                            </button>
                        )}
                        {creating === "event" && (
                            <div className="flex flex-col gap-1 border rounded p-2 bg-gray-50">
                                <div className="flex flex-wrap items-center gap-2">
                                    <input value={newEvent.name} onChange={e => setNewEvent(v => ({ ...v, name: e.target.value }))} placeholder="大会名（例: 東京マラソン。年や第〇回は入れない）" className={`${input} w-72`} />
                                    <select value={newEvent.prefecture} onChange={e => setNewEvent(v => ({ ...v, prefecture: e.target.value }))} className={input} aria-label="都道府県">
                                        <option value="">都道府県</option>
                                        {PREFECTURE_ORDER.map(p => <option key={p} value={p}>{p}</option>)}
                                        <option value="海外">海外</option>
                                    </select>
                                    <select value={newEvent.type} onChange={e => setNewEvent(v => ({ ...v, type: e.target.value }))} className={input} aria-label="種別">
                                        {eventTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    <input value={newEvent.url} onChange={e => setNewEvent(v => ({ ...v, url: e.target.value }))} placeholder="公式サイト（任意）" className={`${input} w-56`} />
                                </div>
                                {similarEvents.length > 0 && (
                                    <div className="text-xs bg-yellow-50 border border-yellow-300 rounded p-1">
                                        似た名前の大会があります。同じ大会ならこちらを選んでください:
                                        {similarEvents.map(e => (
                                            <button key={e.id} type="button" onClick={() => chooseEvent(e.id)} className="ml-2 text-blue-600 hover:underline">{e.name}</button>
                                        ))}
                                    </div>
                                )}
                                <div className="flex gap-3">
                                    <button type="button" onClick={addEvent} disabled={busy} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-xs">大会を追加</button>
                                    <button type="button" onClick={() => setCreating(null)} className="text-xs text-gray-600 hover:underline">やめる</button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* 2. 開催日 */}
            {event && (
                <div className="flex flex-col gap-1">
                    <span className="font-semibold">開催日</span>
                    <div className="flex flex-wrap gap-1">
                        {editionOptions.map(ed => (
                            <button key={ed.id} type="button" onClick={() => chooseEdition(ed.id)} className={chip(ed.id === editionId)}>
                                {ed.held_on ? formatDate(ed.held_on) : "開催日未定"}{ed.edition_number != null && ` 第${ed.edition_number}回`}
                                {ed.name && <span className="ml-1 text-xs opacity-75">（当時: {ed.name}）</span>}
                            </button>
                        ))}
                        {editionOptions.length === 0 && <span className="text-gray-500">開催日がまだ登録されていません</span>}
                    </div>
                    {allowCreate && creating !== "edition" && estimate && (
                        <button
                            type="button"
                            onClick={() => { setNewEdition({ date: estimate.date, number: "" }); setCreating("edition") }}
                            className="self-start px-2 py-1 rounded border border-orange-300 bg-orange-50 hover:bg-orange-100 text-sm"
                        >
                            ＋ 今年の開催日を追加（{yearsAgoLabel(estimate.from!)}は {formatDate(estimate.from!)}。同じ曜日の {formatDate(estimate.date)} を入れておきます）
                        </button>
                    )}
                    {allowCreate && creating !== "edition" && (
                        <button type="button" onClick={() => setCreating("edition")} className={`${addLink} self-start`}>＋ 開催日を追加</button>
                    )}
                    {creating === "edition" && (
                        <div className="flex flex-wrap items-center gap-2 border rounded p-2 bg-gray-50">
                            <input type="date" value={newEdition.date} onChange={e => setNewEdition(v => ({ ...v, date: e.target.value }))} className={input} aria-label="開催日" />
                            <input value={newEdition.number} onChange={e => setNewEdition(v => ({ ...v, number: e.target.value }))} placeholder="第〇回（任意）" inputMode="numeric" className={`${input} w-28`} />
                            <button type="button" onClick={addEdition} disabled={busy} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-xs">開催日を追加</button>
                            <button type="button" onClick={() => setCreating(null)} className="text-xs text-gray-600 hover:underline">やめる</button>
                        </div>
                    )}
                </div>
            )}

            {/* 3. 種目 */}
            {edition && (
                <div className="flex flex-col gap-1">
                    <span className="font-semibold">種目</span>
                    <div className="flex flex-wrap gap-1">
                        {raceOptions.map(r => (
                            <button key={r.id} type="button" onClick={() => emit(r)} className={chip(r.id === race?.id)}>
                                {r.name}<span className="ml-1 text-xs opacity-75">{formatDistance(r.distance_km)}</span>
                            </button>
                        ))}
                        {raceOptions.length === 0 && <span className="text-gray-500">種目がまだ登録されていません</span>}
                    </div>
                    {allowCreate && creating !== "race" && (
                        <button type="button" onClick={() => setCreating("race")} className={`${addLink} self-start`}>＋ 種目を追加</button>
                    )}
                    {creating === "race" && (
                        <div className="flex flex-wrap items-center gap-2 border rounded p-2 bg-gray-50">
                            {DISTANCE_PRESETS.map(p => (
                                <button key={p.label} type="button" onClick={() => setNewRace({ name: p.name, km: String(p.km) })} className="px-2 py-0.5 border rounded bg-white hover:bg-gray-100 text-xs">{p.label}</button>
                            ))}
                            <input value={newRace.name} onChange={e => setNewRace(v => ({ ...v, name: e.target.value }))} placeholder="種目名（例: フルマラソン）" className={`${input} w-44`} />
                            <input value={newRace.km} onChange={e => setNewRace(v => ({ ...v, km: e.target.value }))} placeholder="距離 km" inputMode="decimal" className={`${input} w-24`} />
                            <button type="button" onClick={addRace} disabled={busy} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-xs">種目を追加</button>
                            <button type="button" onClick={() => setCreating(null)} className="text-xs text-gray-600 hover:underline">やめる</button>
                        </div>
                    )}
                </div>
            )}
            {message && <p className="text-red-600">{message}</p>}
            {allowCreate && (
                <p className="text-xs text-gray-500">
                    大会・開催日・種目はメンバーなら誰でも追加できます（直すのは追加した人と管理人）。重複に気づいたら管理人がまとめます。
                </p>
            )}
        </div>
    )
}
