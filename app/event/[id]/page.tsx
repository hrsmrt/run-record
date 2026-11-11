"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from 'react'
import { useParams } from "next/navigation"
import { ExternalLink } from "lucide-react"
import Link from "next/link"
import { safeHttpUrl } from "@/lib/url"
import { EditionResults, EventResult } from "@/components/EditionResults"
import { SplitPoint } from "@/lib/splits"
import { EditionReports, RaceReport } from "@/components/EditionReports"
import { VIEWER_ROLE } from "@/lib/viewer"
import { RACE_ROUTE_COLUMNS, RaceRoutes, type RaceRouteInfo } from "@/components/RaceRoutes"
import { EditionOrganizers, type EditionOrganizer } from "@/components/EditionOrganizers"
import { RacePlanPanel } from "@/components/RacePlanPanel"
import type { RacePlan } from "@/lib/race-plans"
import { todayStr } from "@/lib/practices"

type Race = {
    id: number
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

type EventEdition = {
    id: number
    edition_number: number | null
    held_on: string | null
    races: Race[]
}

type EventDetail = {
    id: number
    name: string
    url: string | null
    type: string
    prefecture: string | null
    event_editions: EventEdition[]
}

const formatDate = (d: string) => `${d.substring(0, 4)}/${d.substring(5, 7)}/${d.substring(8, 10)}`

// TIMESTAMPTZ はブラウザのタイムゾーンで表示する
const formatDateTime = (iso: string) => {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// エントリー数 "12,000人（男子 9,000・女子 3,000）"
const formatEntrants = (r: Race) => {
    const parts = [
        r.entrants_male != null ? `男子 ${r.entrants_male.toLocaleString()}` : null,
        r.entrants_female != null ? `女子 ${r.entrants_female.toLocaleString()}` : null,
    ].filter(Boolean)
    const total = r.entrants_total != null ? `${r.entrants_total.toLocaleString()}人` : ""
    return parts.length > 0 ? `${total}（${parts.join("・")}）` : total
}

const formatTimeLimit = (minutes: number) => {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    if (h === 0) return `${m}分`
    return m === 0 ? `${h}時間` : `${h}時間${m}分`
}

const formatEntryPeriod = (start: string | null, end: string | null) => {
    if (!start && !end) return ""
    return `${start ? formatDateTime(start) : ""} 〜 ${end ? formatDateTime(end) : ""}`
}

export default function EventDetailPage() {
    const { id } = useParams<{ id: string }>()
    const [event, setEvent] = useState<EventDetail | null>(null)
    const [status, setStatus] = useState<"loading" | "notFound" | "error" | "ok">("loading")
    const [results, setResults] = useState<EventResult[]>([])
    const [splits, setSplits] = useState<Map<number, SplitPoint[]>>(new Map())
    const [reports, setReports] = useState<RaceReport[]>([])
    // レポートを書けるのはメンバー（閲覧用アカウント以外）のみ
    const [canWrite, setCanWrite] = useState(false)
    // 種目ごとのコース（GPX）と、自分が登録できる種目
    const [routes, setRoutes] = useState<Map<number, RaceRouteInfo>>(new Map())
    const [routeEditable, setRouteEditable] = useState<Set<number>>(new Set())
    const [routeReload, setRouteReload] = useState(0)
    // 開催回ごとの幹事
    const [organizers, setOrganizers] = useState<EditionOrganizer[]>([])
    const [organizerReload, setOrganizerReload] = useState(0)
    // 開催回ごとのメンバーの予定（これからの開催回だけ出す）
    const [plans, setPlans] = useState<RacePlan[]>([])
    const [planReload, setPlanReload] = useState(0)
    // メンバーが追加した大会・開催回の、追加した人の名前（"event:ID" / "edition:ID" → 名前）
    const [creators, setCreators] = useState<Map<string, string>>(new Map())

    useEffect(() => {
        const fetchEvent = async () => {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('events')
                .select('id, name, url, type, prefecture, event_editions(id, edition_number, held_on, races(*))')
                .eq('id', Number(id))
                .maybeSingle()
            if (error) {
                console.error('Error fetching event:', error)
                setStatus("error")
                return
            }
            if (!data) {
                setStatus("notFound")
                return
            }
            const detail = data as unknown as EventDetail
            // 開催回は新しい順（開催日未定は先頭）、種目は距離の長い順
            detail.event_editions.sort((a, b) => {
                if (!a.held_on) return -1
                if (!b.held_on) return 1
                return b.held_on.localeCompare(a.held_on)
            })
            detail.event_editions.forEach(ed => ed.races.sort((a, b) => b.distance_km - a.distance_km))
            setEvent(detail)
            setStatus("ok")

            const [{ data: { user } }, { data: reportData, error: reportError }] = await Promise.all([
                supabase.auth.getUser(),
                supabase
                    .from('public_race_reports')
                    .select('id, event_edition_id, event_id, held_on, author_name, author_gender, race_body, travel_body, updated_at, is_runner, is_mine')
                    .eq('event_id', detail.id)
                    .order('updated_at', { ascending: false }),
            ])
            setCanWrite(!!user && user.app_metadata?.role !== VIEWER_ROLE)
            if (reportError) console.error('Error fetching reports:', reportError)
            else setReports((reportData ?? []) as RaceReport[])

            // この大会に紐付いた記録（公開ビュー）と、そのラップ
            const { data: resData, error: resError } = await supabase
                .from('public_results')
                .select('id, name, gender, time_ms, clever_index, race_id, overall_rank, overall_total, gender_rank, gender_total, division, division_rank, division_total, enrollment_year, entered_by_name')
                .eq('event_id', detail.id)
            if (resError) {
                console.error('Error fetching results:', resError)
                return
            }
            const eventResults = (resData ?? []) as EventResult[]
            setResults(eventResults)
            if (eventResults.length === 0) return
            const { data: splitData, error: splitError } = await supabase
                .from('result_splits')
                .select('result_id, distance_km, elapsed_ms, rank')
                .in('result_id', eventResults.map(r => r.id))
            if (splitError) {
                console.error('Error fetching splits:', splitError)
                return
            }
            const byResult = new Map<number, SplitPoint[]>()
            for (const sp of splitData ?? []) {
                const list = byResult.get(sp.result_id) ?? []
                list.push({ km: Number(sp.distance_km), ms: sp.elapsed_ms, rank: sp.rank })
                byResult.set(sp.result_id, list)
            }
            setSplits(byResult)
        }
        fetchEvent()
    }, [id])

    // コースは登録・差し替えのたびに読み直す（routeReload を増やす）
    useEffect(() => {
        if (!event) return
        const raceIds = event.event_editions.flatMap(ed => ed.races.map(r => r.id))
        if (raceIds.length === 0) return
        const fetchRoutes = async () => {
            const supabase = createClient()
            const [{ data: routeData }, { data: editableData }] = await Promise.all([
                supabase.from("public_race_routes").select(RACE_ROUTE_COLUMNS).in("race_id", raceIds),
                // 閲覧用アカウントは登録できないので問い合わせない
                canWrite ? supabase.rpc("race_route_editable", { p_race_ids: raceIds }) : Promise.resolve({ data: [] }),
            ])
            setRoutes(new Map(((routeData ?? []) as RaceRouteInfo[]).map(r => [r.race_id, r])))
            setRouteEditable(new Set((editableData ?? []) as number[]))
        }
        fetchRoutes()
    }, [event, canWrite, routeReload])

    useEffect(() => {
        if (!event) return
        createClient().from("public_catalog_creators").select("kind, id, name")
            .or(`and(kind.eq.event,id.eq.${event.id}),and(kind.eq.edition,id.in.(${event.event_editions.map(ed => ed.id).join(",") || "0"}))`)
            .then(({ data }) => setCreators(new Map((data ?? []).map(c => [`${c.kind}:${c.id}`, c.name as string]))))
    }, [event])

    // 幹事は「幹事になる・やめる」のたびに読み直す
    useEffect(() => {
        if (!event) return
        const editionIds = event.event_editions.map(ed => ed.id)
        if (editionIds.length === 0) return
        createClient().from("public_edition_organizers").select("*").in("event_edition_id", editionIds)
            .then(({ data }) => setOrganizers((data ?? []) as EditionOrganizer[]))
    }, [event, organizerReload])

    // 予定はボタンを押すたびに読み直す
    useEffect(() => {
        if (!event) return
        const editionIds = event.event_editions.map(ed => ed.id)
        if (editionIds.length === 0) return
        createClient().from("public_race_plans").select("*").in("event_edition_id", editionIds).order("updated_at")
            .then(({ data }) => setPlans((data ?? []) as RacePlan[]))
    }, [event, planReload])

    // データ読み込み後に描画されるため、URL の #edition-○ への移動を読み込み完了後に行う
    useEffect(() => {
        if (status !== "ok" || !window.location.hash) return
        document.getElementById(window.location.hash.slice(1))?.scrollIntoView()
    }, [status])

    return (
        <main className="min-h-screen flex flex-col items-center p-4">
            <div className="w-full max-w-6xl">
                <nav className="flex gap-4 mb-3 text-sm">
                    <Link href="/event" className="text-blue-600 hover:underline">大会一覧</Link>
                    <Link href="/event/editions" className="text-blue-600 hover:underline">開催一覧</Link>
                    <Link href="/event/schedule" className="text-blue-600 hover:underline">カレンダー</Link>
                </nav>

                {status === "loading" && <p className="text-sm">読み込み中...</p>}
                {status === "notFound" && <p className="text-sm">大会が見つかりませんでした。</p>}
                {status === "error" && <p className="text-sm">読み込みに失敗しました。</p>}

                {event && (
                    <>
                        <h1 className="text-lg font-bold mb-2">
                            {event.name}
                            {creators.has(`event:${event.id}`) && <span className="ml-2 text-xs font-normal text-gray-500">追加: {creators.get(`event:${event.id}`)}</span>}
                        </h1>
                        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm mb-6">
                            <dt className="text-gray-500">県</dt>
                            <dd>{event.prefecture ?? "未設定"}</dd>
                            <dt className="text-gray-500">種別</dt>
                            <dd>{event.type}</dd>
                            <dt className="text-gray-500">公式サイト</dt>
                            <dd className="break-all">
                                {event.url ? (
                                    <a
                                        href={safeHttpUrl(event.url) ?? undefined}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline inline-flex items-center gap-1"
                                    >
                                        {event.url}
                                        <ExternalLink size={12} className="inline shrink-0" />
                                    </a>
                                ) : "なし"}
                            </dd>
                        </dl>

                        <h2 className="text-base font-bold mb-2">開催回</h2>
                        {event.event_editions.length === 0 && (
                            <p className="text-sm">開催回はまだ登録されていません。</p>
                        )}
                        <div className="flex flex-col gap-4">
                            {event.event_editions.map(ed => (
                                <section key={ed.id} id={`edition-${ed.id}`} className="scroll-mt-4">
                                    <h3 className="font-bold text-sm mb-1">
                                        {ed.held_on ? formatDate(ed.held_on) : "開催日未定"}
                                        {ed.edition_number != null && ` 第${ed.edition_number}回`}
                                        {creators.has(`edition:${ed.id}`) && <span className="ml-2 text-xs font-normal text-gray-500">追加: {creators.get(`edition:${ed.id}`)}</span>}
                                    </h3>
                                    {ed.races.length === 0 ? (
                                        <p className="text-sm text-gray-500">種目はまだ登録されていません。</p>
                                    ) : (
                                        <div className="bg-white text-black p-2 text-[8px] md:text-base">
                                            <div className="overflow-x-auto">
                                                <table className="border-collapse w-full text-black bg-white font-mono whitespace-nowrap">
                                                    <thead>
                                                        <tr className="bg-white border-b">
                                                            <th className="px-1 md:px-3 py-0 text-left">種目</th>
                                                            <th className="px-1 md:px-3 py-0 text-right">距離</th>
                                                            <th className="px-1 md:px-3 py-0 text-right">制限時間</th>
                                                            <th className="px-1 md:px-3 py-0 text-right">高低差</th>
                                                            <th className="px-1 md:px-3 py-0 text-right">参加費</th>
                                                            <th className="px-1 md:px-3 py-0 text-right">定員</th>
                                                            <th className="px-1 md:px-3 py-0 text-left">エントリー期間</th>
                                                            <th className="px-1 md:px-3 py-0 text-left">エントリー数</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-200">
                                                        {ed.races.map(r => (
                                                            <tr key={r.id}>
                                                                <td className="px-1 md:px-3 py-0">{r.name}</td>
                                                                <td className="px-1 md:px-3 py-0 text-right">{r.distance_km}km</td>
                                                                <td className="px-1 md:px-3 py-0 text-right">
                                                                    {r.time_limit_minutes != null ? formatTimeLimit(r.time_limit_minutes) : ""}
                                                                </td>
                                                                <td className="px-1 md:px-3 py-0 text-right">
                                                                    {r.elevation_gain_m != null ? `${r.elevation_gain_m}m` : ""}
                                                                </td>
                                                                <td className="px-1 md:px-3 py-0 text-right">
                                                                    {r.entry_fee != null ? `${r.entry_fee.toLocaleString()}円` : ""}
                                                                </td>
                                                                <td className="px-1 md:px-3 py-0 text-right">
                                                                    {r.capacity != null ? `${r.capacity.toLocaleString()}人` : ""}
                                                                </td>
                                                                <td className="px-1 md:px-3 py-0">
                                                                    {formatEntryPeriod(r.entry_start_at, r.entry_end_at)}
                                                                </td>
                                                                <td className="px-1 md:px-3 py-0">{formatEntrants(r)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                    {(!ed.held_on || ed.held_on >= todayStr()) && (canWrite || plans.some(p => p.event_edition_id === ed.id)) && (
                                        <div className="mt-2 bg-white text-black p-2 border rounded">
                                            <h4 className="text-xs font-bold text-gray-600 mb-1">メンバーの予定</h4>
                                            <RacePlanPanel
                                                editionId={ed.id}
                                                races={ed.races}
                                                plans={plans.filter(p => p.event_edition_id === ed.id)}
                                                canEdit={canWrite}
                                                onChanged={() => setPlanReload(n => n + 1)}
                                            />
                                        </div>
                                    )}
                                    <EditionOrganizers
                                        editionId={ed.id}
                                        organizers={organizers.filter(o => o.event_edition_id === ed.id)}
                                        canJoin={canWrite}
                                        onChanged={() => setOrganizerReload(n => n + 1)}
                                    />
                                    <RaceRoutes
                                        races={ed.races}
                                        routes={routes}
                                        editable={routeEditable}
                                        onChanged={() => setRouteReload(n => n + 1)}
                                    />
                                    <EditionResults
                                        races={ed.races}
                                        results={results.filter(r => ed.races.some(ra => ra.id === r.race_id))}
                                        splits={splits}
                                    />
                                    <EditionReports
                                        editionId={ed.id}
                                        reports={reports.filter(r => r.event_edition_id === ed.id)}
                                        canWrite={canWrite}
                                    />
                                </section>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </main>
    )
}
