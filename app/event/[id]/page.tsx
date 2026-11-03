"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from 'react'
import { useParams } from "next/navigation"
import { ExternalLink } from "lucide-react"
import Link from "next/link"

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
        }
        fetchEvent()
    }, [id])

    return (
        <main className="min-h-screen flex flex-col items-center p-4">
            <div className="w-full max-w-3xl">
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
                        <h1 className="text-lg font-bold mb-2">{event.name}</h1>
                        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm mb-6">
                            <dt className="text-gray-500">県</dt>
                            <dd>{event.prefecture ?? "未設定"}</dd>
                            <dt className="text-gray-500">種別</dt>
                            <dd>{event.type}</dd>
                            <dt className="text-gray-500">公式サイト</dt>
                            <dd className="break-all">
                                {event.url ? (
                                    <a
                                        href={event.url}
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
                                <section key={ed.id}>
                                    <h3 className="font-bold text-sm mb-1">
                                        {ed.held_on ? formatDate(ed.held_on) : "開催日未定"}
                                        {ed.edition_number != null && ` 第${ed.edition_number}回`}
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
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </section>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </main>
    )
}
