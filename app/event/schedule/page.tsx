"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from 'react'
import Link from "next/link"
import { PLAN_LABELS, PLAN_STYLES, type PlanStatus } from "@/lib/race-plans"
import { EntryInfoBadge } from "@/components/EntryInfoBadge"
import type { EntryDifficulty, EntryMethod } from "@/lib/event-info"

type EventEdition = {
    id: number
    held_on: string | null
    events: {
        id: number
        name: string
        entry_method: EntryMethod | null
        entry_difficulty: EntryDifficulty | null
    }
}

type Week = {
    label: string
    events: EventEdition[]
}

const toFiscalYear = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1
}

const localDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const pad = (n: number) => String(n).padStart(2, '\u2007')

function buildWeekList(editions: EventEdition[], fy: number): Week[] {
    const april1 = new Date(fy, 3, 1)
    const dow = april1.getDay()
    const daysToSat = dow === 6 ? 0 : (6 - dow + 7) % 7
    const current = new Date(april1)
    current.setDate(april1.getDate() + daysToSat)
    const march31 = new Date(fy + 1, 2, 31)

    const weeks: Week[] = []

    while (current <= march31) {
        const sat = new Date(current)
        const sun = new Date(current)
        sun.setDate(sun.getDate() + 1)

        const mon = new Date(sat)
        mon.setDate(sat.getDate() - 5) // 土曜の5日前 = 月曜

        const month = sat.getMonth() + 1
        const weekOfMonth = Math.ceil(sat.getDate() / 7)
        const monM = mon.getMonth() + 1
        const sunM = sun.getMonth() + 1
        const label = `${pad(month)}月第${weekOfMonth}週 (${pad(monM)}/${pad(mon.getDate())}-${pad(sunM)}/${pad(sun.getDate())})`
        const monStr = localDateStr(mon)
        const sunStr = localDateStr(sun)
        const weekEvents = editions.filter(e => e.held_on && e.held_on >= monStr && e.held_on <= sunStr)

        weeks.push({ label, events: weekEvents })
        current.setDate(current.getDate() + 7)
    }

    return weeks
}

// 開催回ごとのメンバーの予定（人数と自分の状態）
type PlanMark = { count: number; recruiting: boolean; mine: PlanStatus | null }

export default function EventSchedulePage() {
    const [editions, setEditions] = useState<EventEdition[]>([])
    const [marks, setMarks] = useState<Map<number, PlanMark>>(new Map())

    const currentFiscalYear = () => {
        const today = new Date()
        return today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1
    }
    const [selectedYear, setSelectedYear] = useState<number>(currentFiscalYear())

    useEffect(() => {
        const fetchEditions = async () => {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('event_editions')
                .select('id, held_on, events(id, name, entry_method, entry_difficulty)')
                .order('held_on', { ascending: true })
            if (error) {
                console.error('Error fetching event editions:', error)
            } else {
                setEditions(data as unknown as EventEdition[])
            }
        }
        fetchEditions()
        createClient().from("public_race_plans").select("event_edition_id, status, recruiting, is_me")
            .then(({ data }) => {
                const m = new Map<number, PlanMark>()
                for (const p of (data ?? []) as { event_edition_id: number; status: PlanStatus; recruiting: boolean; is_me: boolean }[]) {
                    const cur = m.get(p.event_edition_id) ?? { count: 0, recruiting: false, mine: null }
                    m.set(p.event_edition_id, { count: cur.count + 1, recruiting: cur.recruiting || p.recruiting, mine: p.is_me ? p.status : cur.mine })
                }
                setMarks(m)
            })
    }, [])

    const fiscalYears = [...new Set(editions.filter(e => e.held_on).map(e => toFiscalYear(e.held_on!)))].sort()
    const fyEditions = editions.filter(e => e.held_on && toFiscalYear(e.held_on) === selectedYear)
    const weeks = buildWeekList(fyEditions, selectedYear)

    return (
        <main className="min-h-screen flex flex-col items-center p-4">
            <div className="w-full max-w-3xl">
                <nav className="flex gap-4 mb-3 text-sm">
                    <Link href="/event" className="text-blue-600 hover:underline">大会一覧</Link>
                    <Link href="/event/editions" className="text-blue-600 hover:underline">開催一覧</Link>
                    <span className="font-bold">カレンダー</span>
                </nav>
                <div className="flex items-center gap-4 mb-2">
                    <h1 className="text-lg font-bold">大会カレンダー</h1>
                    <select
                        value={selectedYear}
                        onChange={e => setSelectedYear(Number(e.target.value))}
                        className="px-2 py-1 border rounded text-sm"
                    >
                        {fiscalYears.map(y => (
                            <option key={y} value={y}>{y}年度</option>
                        ))}
                    </select>
                </div>
                <div className="bg-white text-black p-2 text-[8px] md:text-base">
                    <div className="overflow-x-auto">
                        <table className="table-fixed border-collapse w-full text-black bg-white font-mono">
                            <thead>
                                <tr className="bg-white border-b">
                                    <th className="px-1 md:px-3 py-0 text-left w-[40%]">週</th>
                                    <th className="px-1 md:px-3 py-0 text-left">大会</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {weeks.map((week, index) => (
                                    <tr key={index}>
                                        <td className="px-1 md:px-3 py-0 whitespace-nowrap">{week.label}</td>
                                        <td className="px-1 md:px-3 py-0">
                                            <div className="flex flex-wrap gap-x-4">
                                                {week.events.map(ed => {
                                                    const dateLabel = ed.held_on
                                                        ? ` (${parseInt(ed.held_on.substring(5, 7))}/${parseInt(ed.held_on.substring(8, 10))})`
                                                        : ""
                                                    const mark = marks.get(ed.id)
                                                    return (
                                                        <span key={ed.id} className="inline-flex flex-wrap items-center gap-x-2">
                                                            {ed.events.name}{dateLabel}
                                                            <span className="font-sans"><EntryInfoBadge info={ed.events} /></span>
                                                            {mark?.mine && <span className={`px-1 rounded border font-sans ${PLAN_STYLES[mark.mine]}`}>{PLAN_LABELS[mark.mine]}</span>}
                                                            {mark && <span className={`px-1 rounded font-sans ${mark.recruiting ? "bg-orange-100 text-orange-800" : "bg-gray-100 text-gray-700"}`}>{mark.recruiting ? "募集中・" : ""}メンバー{mark.count}人</span>}
                                                            <Link href={`/event/${ed.events.id}#edition-${ed.id}`} className="text-xs text-blue-600 hover:underline shrink-0">詳細</Link>
                                                        </span>
                                                    )
                                                })}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </main>
    )
}
