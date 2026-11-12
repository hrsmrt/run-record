"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { type CatalogEditionRow, type EventCatalog, loadEventCatalog, matchEdition, racesOfEvent, weekdayOf } from "@/lib/event-catalog"
import { holidaysOf } from "@/lib/holidays"
import { todayStr } from "@/lib/practices"
import { EventFilterBar, EventTabs, useEventFilters } from "@/components/EventFilters"
import { DistanceChips, PlanSummary } from "@/components/EventRowParts"
import { EntryInfoBadge } from "@/components/EntryInfoBadge"

const toFiscalYear = (date: string) => {
    const y = Number(date.substring(0, 4)), m = Number(date.substring(5, 7))
    return m >= 4 ? y : y - 1
}
const localDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const md = (date: string) => `${Number(date.substring(5, 7))}/${Number(date.substring(8, 10))}`

type Week = {
    label: string
    // 土曜の月（見出し用）
    month: number
    mon: string
    sun: string
    holidays: [string, string][]
    // 金曜か月曜が祝日で、土日とつながる連休
    longWeekend: boolean
    editions: CatalogEditionRow[]
}

// 年度の週（月〜日）。週の名前は土曜の日付で「11月第2週」とする
function buildWeeks(editions: CatalogEditionRow[], fy: number): Week[] {
    const april1 = new Date(fy, 3, 1)
    const sat = new Date(april1)
    sat.setDate(april1.getDate() + ((6 - april1.getDay() + 7) % 7))
    const march31 = new Date(fy + 1, 2, 31)
    const holidays = new Map([...holidaysOf(fy), ...holidaysOf(fy + 1)])
    const weeks: Week[] = []
    while (sat <= march31) {
        const mon = new Date(sat); mon.setDate(sat.getDate() - 5)
        const sun = new Date(sat); sun.setDate(sat.getDate() + 1)
        const fri = new Date(sat); fri.setDate(sat.getDate() - 1)
        const nextMon = new Date(sat); nextMon.setDate(sat.getDate() + 2)
        const monStr = localDateStr(mon), sunStr = localDateStr(sun)
        weeks.push({
            label: `${sat.getMonth() + 1}月第${Math.ceil(sat.getDate() / 7)}週（${md(monStr)}〜${md(sunStr)}）`,
            month: sat.getMonth() + 1,
            mon: monStr,
            sun: sunStr,
            holidays: [...holidays.entries()].filter(([d]) => d >= monStr && d <= sunStr).sort(),
            longWeekend: holidays.has(localDateStr(fri)) || holidays.has(localDateStr(nextMon)),
            editions: editions.filter(e => e.held_on! >= monStr && e.held_on! <= sunStr).sort((a, b) => a.held_on!.localeCompare(b.held_on!)),
        })
        sat.setDate(sat.getDate() + 7)
    }
    return weeks
}

// カレンダー: 年度ごとの週の一覧。開いたら今週へ移動し、過ぎた週は薄くする。祝日・連休の印を付ける
export function ScheduleClient() {
    const f = useEventFilters()
    const [catalog, setCatalog] = useState<EventCatalog | null>(null)
    const [error, setError] = useState("")
    const today = todayStr()
    const fy = Number(f.params.get("fy") ?? toFiscalYear(today))
    const thisWeekRef = useRef<HTMLLIElement>(null)
    const scrolledRef = useRef(false)

    useEffect(() => { loadEventCatalog(createClient()).then(setCatalog).catch((e: Error) => setError(e.message)) }, [])

    const fiscalYears = useMemo(() => {
        const years = new Set((catalog?.editions ?? []).filter(e => e.held_on).map(e => toFiscalYear(e.held_on!)))
        years.add(toFiscalYear(today))
        return [...years].sort((a, b) => b - a)
    }, [catalog, today])

    const weeks = useMemo(() => {
        if (!catalog) return []
        const eds = catalog.editions.filter(e => e.held_on && toFiscalYear(e.held_on) === fy && matchEdition(catalog, e, f.filter))
        return buildWeeks(eds, fy)
    }, [catalog, fy, f.filter])

    // 最初に表示したときだけ今週へ移動する
    useEffect(() => {
        if (scrolledRef.current || weeks.length === 0 || !thisWeekRef.current) return
        scrolledRef.current = true
        thisWeekRef.current.scrollIntoView({ block: "center" })
    }, [weeks])

    const count = weeks.reduce((n, w) => n + w.editions.length, 0)

    return (
        <main className="min-h-screen flex flex-col items-center p-4">
            <div className="w-full max-w-4xl">
                <EventTabs current="/event/schedule" params={f.params} />
                {error && <p className="text-sm text-red-600">読み込みに失敗しました: {error}</p>}
                {!catalog ? (!error && <p className="text-sm">読み込み中...</p>) : (
                    <>
                        <EventFilterBar catalog={catalog} {...f}>
                            <label className="flex items-center gap-1">
                                年度
                                <select value={fy} onChange={e => f.setParams({ fy: Number(e.target.value) === toFiscalYear(today) ? "" : e.target.value })} className="border rounded px-1 py-1 bg-white">
                                    {fiscalYears.map(y => <option key={y} value={y}>{y}年度</option>)}
                                </select>
                            </label>
                            {fy === toFiscalYear(today) && (
                                <button onClick={() => thisWeekRef.current?.scrollIntoView({ block: "center", behavior: "smooth" })} className="text-blue-600 hover:underline">今週へ</button>
                            )}
                        </EventFilterBar>
                        <p className="text-sm mb-1">{fy}年度 {count}件</p>
                        <ul className="flex flex-col">
                            {weeks.map((w, i) => {
                                const isThisWeek = today >= w.mon && today <= w.sun
                                const isPast = w.sun < today
                                return (
                                    <li key={w.mon} ref={isThisWeek ? thisWeekRef : undefined} className="flex flex-col scroll-mt-4">
                                        {(i === 0 || weeks[i - 1].month !== w.month) && <h2 className="mt-3 mb-1 text-sm font-bold">{w.month}月</h2>}
                                        <div className={`text-black px-2 py-1 border-b text-sm flex flex-col gap-0.5 ${isThisWeek ? "bg-yellow-50 border-l-4 border-l-yellow-400" : "bg-white"} ${isPast ? "opacity-60" : ""}`}>
                                            <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-gray-600">
                                                <span className="font-mono">{w.label}</span>
                                                {isThisWeek && <span className="font-bold text-yellow-700">今週</span>}
                                                {w.longWeekend && <span className="px-1 rounded bg-red-50 text-red-700">連休</span>}
                                                {w.holidays.map(([d, name]) => <span key={d} className="text-red-600">{md(d)} {name}</span>)}
                                            </div>
                                            {w.editions.map(ed => {
                                                const ev = catalog.events.find(e => e.id === ed.event_id)!
                                                const own = catalog.races.filter(r => r.event_edition_id === ed.id)
                                                const wd = weekdayOf(ed.held_on!)
                                                return (
                                                    <div key={ed.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pl-2">
                                                        <span className={`font-mono text-xs ${wd === "日" ? "text-red-600" : wd === "土" ? "text-blue-600" : ""}`}>{md(ed.held_on!)}（{wd}）</span>
                                                        <Link href={`/event/${ev.id}#edition-${ed.id}`} className="font-bold text-blue-600 hover:underline">{ev.name}</Link>
                                                        <span className="text-xs text-gray-600">{ev.prefecture ?? ""}</span>
                                                        <DistanceChips races={own.length > 0 ? own : racesOfEvent(catalog, ev.id)} />
                                                        <EntryInfoBadge info={ev} />
                                                        <PlanSummary plans={catalog.plans.get(ed.id)} />
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </li>
                                )
                            })}
                        </ul>
                    </>
                )}
            </div>
        </main>
    )
}
