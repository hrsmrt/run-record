"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import {
    type EventCatalog, entryStateOf, formatYmd, loadEventCatalog, matchEdition, racesOfEvent, weekdayOf,
} from "@/lib/event-catalog"
import { holidayName } from "@/lib/holidays"
import { todayStr } from "@/lib/practices"
import { EventFilterBar, EventTabs, useEventFilters } from "@/components/EventFilters"
import { DistanceChips, EntryStateText, PlanSummary } from "@/components/EventRowParts"
import { EntryInfoBadge } from "@/components/EntryInfoBadge"

const PAGE = 100

// 開催日順: 開催回ごとに1行。「これから」は近い順、「これまで」は新しい順。月ごとに見出しを入れる
export function EditionListClient() {
    const f = useEventFilters()
    const [catalog, setCatalog] = useState<EventCatalog | null>(null)
    const [error, setError] = useState("")
    const [shown, setShown] = useState(PAGE)
    const past = f.params.get("when") === "past"

    useEffect(() => { loadEventCatalog(createClient()).then(setCatalog).catch((e: Error) => setError(e.message)) }, [])

    const rows = useMemo(() => {
        if (!catalog) return []
        const today = todayStr()
        return catalog.editions
            .filter(ed => past ? !!ed.held_on && ed.held_on < today : !ed.held_on || ed.held_on >= today)
            .filter(ed => matchEdition(catalog, ed, f.filter))
            // 開催日未定は「これから」の最後
            .sort((a, b) => past
                ? b.held_on!.localeCompare(a.held_on!)
                : (a.held_on ?? "9999").localeCompare(b.held_on ?? "9999"))
    }, [catalog, f.filter, past])

    const button = (active: boolean) => `px-2 py-0.5 rounded border ${active ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-gray-100"}`

    return (
        <main className="min-h-screen flex flex-col items-center p-4">
            <div className="w-full max-w-4xl">
                <EventTabs current="/event/editions" params={f.params} />
                {error && <p className="text-sm text-red-600">読み込みに失敗しました: {error}</p>}
                {!catalog ? (!error && <p className="text-sm">読み込み中...</p>) : (
                    <>
                        <EventFilterBar catalog={catalog} {...f}>
                            <span className="flex items-center gap-1">
                                <button onClick={() => f.setParams({ when: "" })} aria-pressed={!past} className={button(!past)}>これから</button>
                                <button onClick={() => f.setParams({ when: "past" })} aria-pressed={past} className={button(past)}>これまで</button>
                            </span>
                        </EventFilterBar>
                        <p className="text-sm mb-1">{rows.length}件</p>
                        <ul className="flex flex-col">
                            {rows.slice(0, shown).map((ed, i) => {
                                const ev = catalog.events.find(e => e.id === ed.event_id)!
                                const own = catalog.races.filter(r => r.event_edition_id === ed.id)
                                const month = ed.held_on?.substring(0, 7) ?? "未定"
                                const prevMonth = i > 0 ? rows[i - 1].held_on?.substring(0, 7) ?? "未定" : null
                                const holiday = ed.held_on ? holidayName(ed.held_on) : null
                                const results = catalog.editionResults.get(ed.id) ?? 0
                                return (
                                    <li key={ed.id} className="flex flex-col">
                                        {month !== prevMonth && (
                                            <h2 className="mt-3 mb-1 text-sm font-bold">{month === "未定" ? "開催日未定" : `${Number(month.substring(0, 4))}年${Number(month.substring(5, 7))}月`}</h2>
                                        )}
                                        <div className="bg-white text-black px-2 py-1.5 mb-1 text-sm flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                            <span className="font-mono text-xs w-[7.5rem] shrink-0">
                                                {ed.held_on ? <>{formatYmd(ed.held_on)}（<span className={holiday || weekdayOf(ed.held_on) === "日" ? "text-red-600" : weekdayOf(ed.held_on) === "土" ? "text-blue-600" : ""}>{weekdayOf(ed.held_on)}</span>）</> : "未定"}
                                            </span>
                                            <Link href={`/event/${ev.id}#edition-${ed.id}`} className="font-bold text-blue-600 hover:underline">{ev.name}</Link>
                                            {ed.edition_number != null && <span className="text-xs text-gray-600">第{ed.edition_number}回</span>}
                                            <span className="text-xs text-gray-600">{ev.prefecture ?? ""}</span>
                                            <DistanceChips races={own.length > 0 ? own : racesOfEvent(catalog, ev.id)} />
                                            {!past && <EntryStateText state={entryStateOf(own)} />}
                                            <EntryInfoBadge info={ev} />
                                            <PlanSummary plans={catalog.plans.get(ed.id)} />
                                            {results > 0 && <span className="text-xs text-gray-600">メンバーの記録 {results}件</span>}
                                            {holiday && <span className="text-xs text-red-600">{holiday}</span>}
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
