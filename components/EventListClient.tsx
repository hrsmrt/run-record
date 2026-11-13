"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import {
    type CatalogEventRow, type EventCatalog, entryStateOf, formatYmd, loadEventCatalog, matchEvent, nextDateOf, weekdayOf,
} from "@/lib/event-catalog"
import { compareByPrefecture } from "@/lib/prefectures"
import { todayStr } from "@/lib/practices"
import { EventFilterBar, EventTabs, useEventFilters } from "@/components/EventFilters"
import { DistanceChips, EntryStateText, PlanSummary } from "@/components/EventRowParts"
import { EntryInfoBadge } from "@/components/EntryInfoBadge"

const SORTS: [string, string][] = [["next", "次の開催日が近い順"], ["name", "名前順"], ["pref", "都道府県順"], ["popular", "メンバーの出場が多い順"]]
const PAGE = 100

// 大会一覧: 大会ごとに1行。次の開催日（未登録なら前回から推定）・距離・エントリー・メンバーの予定と出場を出す
export function EventListClient() {
    const f = useEventFilters()
    const [catalog, setCatalog] = useState<EventCatalog | null>(null)
    const [error, setError] = useState("")
    const [shown, setShown] = useState(PAGE)
    const sort = f.params.get("sort") ?? "next"

    useEffect(() => { loadEventCatalog(createClient()).then(setCatalog).catch((e: Error) => setError(e.message)) }, [])

    const rows = useMemo(() => {
        if (!catalog) return []
        const today = todayStr()
        const list = catalog.events.filter(ev => matchEvent(catalog, ev, f.filter, today)).map(ev => {
            const eds = catalog.editions.filter(e => e.event_id === ev.id)
            const next = nextDateOf(eds, today)
            // 距離は次の回（なければ一番新しい回）の種目で出す（昔だけあった距離を出さないため）
            const shownEdition = next?.editionId ?? [...eds].sort((a, b) => (b.held_on ?? "").localeCompare(a.held_on ?? ""))[0]?.id
            const races = catalog.races.filter(r => r.event_edition_id === shownEdition)
            return { ev, next, races, entry: next?.editionId ? entryStateOf(races) : null, plans: next?.editionId ? catalog.plans.get(next.editionId) : undefined }
        })
        const byName = (a: { ev: CatalogEventRow }, b: { ev: CatalogEventRow }) => a.ev.name.localeCompare(b.ev.name, "ja")
        if (sort === "name") list.sort(byName)
        else if (sort === "pref") list.sort((a, b) => compareByPrefecture(a.ev, b.ev))
        else if (sort === "popular") list.sort((a, b) => (catalog.eventResults.get(b.ev.id) ?? 0) - (catalog.eventResults.get(a.ev.id) ?? 0) || byName(a, b))
        else list.sort((a, b) => (a.next?.date ?? "9999").localeCompare(b.next?.date ?? "9999") || byName(a, b))
        return list
    }, [catalog, f.filter, sort])

    return (
        <main className="min-h-screen flex flex-col items-center p-4">
            <div className="w-full max-w-4xl">
                <EventTabs current="/event" params={f.params} />
                {error && <p className="text-sm text-red-600">読み込みに失敗しました: {error}</p>}
                {!catalog ? (!error && <p className="text-sm">読み込み中...</p>) : (
                    <>
                        <EventFilterBar catalog={catalog} {...f}>
                            <label className="flex items-center gap-1">
                                並び順
                                <select value={sort} onChange={e => f.setParams({ sort: e.target.value === "next" ? "" : e.target.value })} className="border rounded px-1 py-1 bg-white">
                                    {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                </select>
                            </label>
                        </EventFilterBar>
                        <p className="text-sm mb-1">{rows.length}大会</p>
                        <ul className="flex flex-col gap-1">
                            {rows.slice(0, shown).map(({ ev, next, races, entry, plans }) => {
                                const ran = catalog.eventResults.get(ev.id) ?? 0
                                const notes = catalog.noteCounts.get(ev.id) ?? 0
                                return (
                                    <li key={ev.id} className="bg-white text-black px-2 py-1.5 text-sm flex flex-col gap-0.5">
                                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                            <Link href={`/event/${ev.id}`} className="font-bold text-blue-600 hover:underline">{ev.name}</Link>
                                            {catalog.aliases.has(ev.id) && <span className="text-xs text-gray-600">（旧称: {catalog.aliases.get(ev.id)!.join("・")}）</span>}
                                            <span className="text-xs text-gray-600">{ev.prefecture ?? "県未設定"}・{ev.type}</span>
                                            <DistanceChips races={races} />
                                            {catalog.myEvents.has(ev.id) && <span className="text-xs px-1 rounded bg-blue-50 text-blue-800">出場したことあり</span>}
                                        </div>
                                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                                            {next ? (
                                                <span className={`font-mono text-xs ${next.estimated ? "text-orange-600" : ""}`}>
                                                    次回 {formatYmd(next.date)}（{weekdayOf(next.date)}）{next.estimated && "推定"}
                                                    {/* 前々年以前の回からの推定は、もとにした年を添える */}
                                                    {next.from && Number(next.from.substring(0, 4)) < Number(next.date.substring(0, 4)) - 1 && `・前回${next.from.substring(0, 4)}年`}
                                                </span>
                                            ) : <span className="text-xs text-gray-500">開催日の登録なし</span>}
                                            <EntryStateText state={entry} />
                                            <EntryInfoBadge info={ev} />
                                            <PlanSummary plans={plans} />
                                            {ran > 0 && <span className="text-xs text-gray-600">メンバーの出場 延べ{ran}人</span>}
                                            {notes > 0 && <span className="text-xs text-gray-600">メモ{notes}件</span>}
                                        </div>
                                    </li>
                                )
                            })}
                        </ul>
                        {shown < rows.length && (
                            <button onClick={() => setShown(n => n + PAGE)} className="mt-2 px-4 py-2 border rounded bg-white hover:bg-gray-50 text-sm">さらに表示</button>
                        )}
                    </>
                )}
            </div>
        </main>
    )
}
