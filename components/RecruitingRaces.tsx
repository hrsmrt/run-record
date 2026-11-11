"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { VIEWER_ROLE } from "@/lib/viewer"
import { formatDate } from "@/components/RaceGroups"
import { RacePlanPanel } from "@/components/RacePlanPanel"
import { type RacePlan, entryDeadlineText } from "@/lib/race-plans"
import { todayStr } from "@/lib/practices"

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"]
const weekday = (date: string) => WEEKDAYS[new Date(`${date}T00:00:00`).getDay()]

type EditionRace = { id: number; name: string; event_edition_id: number; entry_end_at: string | null }

type Recruiting = {
    editionId: number
    eventId: number
    eventName: string
    heldOn: string
    races: EditionRace[]
    // まだ締め切っていない種目のうち、一番遅い締切（不明なら null）
    entryEndAt: string | null
    plans: RacePlan[]
}

// ホームの「参加者募集中の大会」。誰かが「一緒に出る人を募集」にしている、これからの開催回を日付の近い順に出す。
// エントリー締切がすべて過ぎた開催回は出さない（締切が登録されていなければ開催日まで出す）
export function RecruitingRaces() {
    const [items, setItems] = useState<Recruiting[]>([])
    const [canEdit, setCanEdit] = useState(false)

    const load = useCallback(async () => {
        const supabase = createClient()
        const [{ data: planData }, { data: claims }] = await Promise.all([
            supabase.from("public_race_plans").select("*").gte("held_on", todayStr()).order("updated_at"),
            supabase.auth.getClaims(),
        ])
        setCanEdit(!!claims?.claims && claims.claims.app_metadata?.role !== VIEWER_ROLE)
        const plans = (planData ?? []) as RacePlan[]
        const editionIds = [...new Set(plans.filter(p => p.recruiting).map(p => p.event_edition_id))]
        if (editionIds.length === 0) { setItems([]); return }
        const { data: raceData } = await supabase.from("races").select("id, name, event_edition_id, entry_end_at").in("event_edition_id", editionIds)
        const races = (raceData ?? []) as EditionRace[]
        const now = Date.now()
        const list = editionIds.flatMap(id => {
            const edPlans = plans.filter(p => p.event_edition_id === id)
            const edRaces = races.filter(r => r.event_edition_id === id)
            const ends = edRaces.map(r => r.entry_end_at).filter((e): e is string => !!e)
            const open = ends.filter(e => new Date(e).getTime() >= now).sort()
            if (ends.length > 0 && open.length === 0) return []
            const first = edPlans[0]
            return [{
                editionId: id, eventId: first.event_id, eventName: first.event_name, heldOn: first.held_on!,
                races: edRaces, entryEndAt: open.at(-1) ?? null, plans: edPlans,
            }]
        })
        list.sort((a, b) => a.heldOn.localeCompare(b.heldOn))
        setItems(list)
    }, [])

    useEffect(() => { load() }, [load])

    if (items.length === 0) return null
    return (
        <section id="home-recruiting" className="flex flex-col gap-1 scroll-mt-4">
            <h2 className="font-bold flex items-center gap-3">
                参加者募集中の大会
                <Link href="/event/schedule" className="text-xs font-normal text-blue-600 hover:underline">カレンダー</Link>
            </h2>
            <ul className="flex flex-col gap-1">
                {items.map(it => {
                    const deadline = entryDeadlineText(it.entryEndAt)
                    return (
                        <li key={it.editionId} className="bg-white border-l-4 border-orange-500 px-2 py-1.5 text-sm flex flex-col gap-1">
                            <div className="flex flex-wrap items-baseline gap-x-3">
                                <span className="font-mono font-bold">{formatDate(it.heldOn)}（{weekday(it.heldOn)}）</span>
                                <Link href={`/event/${it.eventId}#edition-${it.editionId}`} className="font-bold text-blue-600 hover:underline">{it.eventName}</Link>
                                {deadline && <span className="text-xs font-bold text-red-600">エントリー{deadline}</span>}
                            </div>
                            <RacePlanPanel editionId={it.editionId} races={it.races} plans={it.plans} canEdit={canEdit} compact onChanged={load} />
                        </li>
                    )
                })}
            </ul>
            <p className="text-xs text-gray-500">種目・ひとこと・募集は、大会名から大会のページで設定できます。</p>
        </section>
    )
}
