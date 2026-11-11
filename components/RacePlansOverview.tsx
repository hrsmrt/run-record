"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { VIEWER_ROLE } from "@/lib/viewer"
import { formatDate } from "@/components/RaceGroups"
import { RacePlanPanel } from "@/components/RacePlanPanel"
import { MissingResults } from "@/components/MissingResults"
import { EditionThreads, type EditionThread } from "@/components/EditionThreads"
import { PLAN_LABELS, PLAN_STYLES, type RacePlan, entryStatusText } from "@/lib/race-plans"
import { todayStr } from "@/lib/practices"

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"]
const weekday = (date: string) => WEEKDAYS[new Date(`${date}T00:00:00`).getDay()]

type EditionRace = { id: number; name: string; event_edition_id: number; entry_start_at: string | null; entry_end_at: string | null }

// 種目を選んでいればその種目の、未定なら開催回の種目全体のエントリー期間（開始は一番早い、締切は一番遅い）
function entryPeriod(races: EditionRace[], raceId: number | null) {
    const list = raceId != null && races.some(r => r.id === raceId) ? races.filter(r => r.id === raceId) : races
    const starts = list.map(r => r.entry_start_at).filter((s): s is string => !!s).sort()
    const ends = list.map(r => r.entry_end_at).filter((s): s is string => !!s).sort()
    return entryStatusText(starts[0] ?? null, ends.at(-1) ?? null)
}

// 大会予定のページ: 記録の入力の案内、自分の予定（エントリー期間の状況つき）、メンバーの予定（開催回ごと）
export function RacePlansOverview() {
    const [plans, setPlans] = useState<RacePlan[] | null>(null)
    const [races, setRaces] = useState<EditionRace[]>([])
    const [threads, setThreads] = useState<EditionThread[]>([])
    const [canEdit, setCanEdit] = useState(false)

    const load = useCallback(async () => {
        const supabase = createClient()
        const [{ data: planData }, { data: claims }] = await Promise.all([
            supabase.from("public_race_plans").select("*").gte("held_on", todayStr()).order("updated_at"),
            supabase.auth.getClaims(),
        ])
        setCanEdit(!!claims?.claims && claims.claims.app_metadata?.role !== VIEWER_ROLE)
        const list = (planData ?? []) as RacePlan[]
        const editionIds = [...new Set(list.map(p => p.event_edition_id))]
        if (editionIds.length > 0) {
            const [{ data: raceData }, { data: threadData }] = await Promise.all([
                supabase.from("races").select("id, name, event_edition_id, entry_start_at, entry_end_at").in("event_edition_id", editionIds),
                supabase.from("public_board_threads").select("id, title, edition_id").in("edition_id", editionIds).order("created_at"),
            ])
            setRaces(((raceData ?? []) as EditionRace[]).sort((a, b) => a.name.localeCompare(b.name, "ja")))
            setThreads((threadData ?? []) as EditionThread[])
        }
        setPlans(list)
    }, [])

    useEffect(() => { load() }, [load])

    if (!plans) return <p className="text-sm">読み込み中...</p>

    const byHeldOn = (a: RacePlan, b: RacePlan) => (a.held_on ?? "").localeCompare(b.held_on ?? "")
    const mine = plans.filter(p => p.is_me).sort(byHeldOn)
    const editions = [...new Map([...plans].sort(byHeldOn).map(p => [p.event_edition_id, p])).values()]

    return (
        <div className="flex flex-col gap-4 text-black">
            {canEdit && <MissingResults />}

            {canEdit && (
                <section className="flex flex-col gap-1">
                    <h2 className="font-bold">自分の予定</h2>
                    {mine.length === 0 ? (
                        <p className="text-sm text-gray-600">
                            まだ予定はありません。大会のページの「メンバーの予定」や、下の一覧のボタンから付けられます（
                            <Link href="/event/schedule" className="text-blue-600 hover:underline">大会カレンダー</Link>）。
                        </p>
                    ) : (
                        <ul className="flex flex-col gap-1">
                            {mine.map(p => {
                                const entry = entryPeriod(races.filter(r => r.event_edition_id === p.event_edition_id), p.race_id)
                                return (
                                    <li key={p.event_edition_id} className="bg-white px-2 py-1.5 text-sm flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                                        <span className="font-mono font-bold">{formatDate(p.held_on!)}（{weekday(p.held_on!)}）</span>
                                        <Link href={`/event/${p.event_id}#edition-${p.event_edition_id}`} className="font-bold text-blue-600 hover:underline">{p.event_name}</Link>
                                        <span className={`text-xs px-1 rounded border ${PLAN_STYLES[p.status]}`}>{PLAN_LABELS[p.status]}</span>
                                        {p.race_name && <span className="text-xs">{p.race_name}</span>}
                                        {entry && <span className={`text-xs ${entry.urgent && p.status !== "entered" ? "font-bold text-red-600" : "text-gray-600"}`}>{entry.text}</span>}
                                        {p.is_private && <span className="text-xs text-gray-500">自分だけに表示</span>}
                                        {p.recruiting && <span className="text-xs px-1 rounded bg-orange-100 text-orange-800">募集中</span>}
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </section>
            )}

            <section className="flex flex-col gap-1">
                <h2 className="font-bold">メンバーの予定</h2>
                {editions.length === 0 && <p className="text-sm text-gray-600">これからの大会の予定はまだありません。</p>}
                <ul className="flex flex-col gap-2">
                    {editions.map(e => {
                        const edPlans = plans.filter(p => p.event_edition_id === e.event_edition_id)
                        const edRaces = races.filter(r => r.event_edition_id === e.event_edition_id)
                        const entry = entryPeriod(edRaces, null)
                        return (
                            <li key={e.event_edition_id} className={`bg-white px-2 py-1.5 text-sm flex flex-col gap-1 border-l-4 ${edPlans.some(p => p.recruiting) ? "border-orange-500" : "border-gray-300"}`}>
                                <div className="flex flex-wrap items-baseline gap-x-3">
                                    <span className="font-mono font-bold">{formatDate(e.held_on!)}（{weekday(e.held_on!)}）</span>
                                    <Link href={`/event/${e.event_id}#edition-${e.event_edition_id}`} className="font-bold text-blue-600 hover:underline">{e.event_name}</Link>
                                    {entry && <span className={`text-xs ${entry.urgent ? "font-bold text-red-600" : "text-gray-600"}`}>{entry.text}</span>}
                                </div>
                                <RacePlanPanel editionId={e.event_edition_id} races={edRaces} plans={edPlans} canEdit={canEdit} onChanged={load} />
                                <EditionThreads editionId={e.event_edition_id} threads={threads.filter(t => t.edition_id === e.event_edition_id)} canCreate={canEdit} />
                            </li>
                        )
                    })}
                </ul>
                <p className="text-xs text-gray-500">
                    「自分だけに表示」にした予定は、ほかのメンバーには見えません。ここにない大会の予定は、
                    <Link href="/event/schedule" className="text-blue-600 hover:underline">大会カレンダー</Link>から大会のページを開いて付けます。
                </p>
            </section>
        </div>
    )
}
