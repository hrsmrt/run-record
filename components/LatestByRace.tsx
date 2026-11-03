"use client"

import { Fragment, useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { formatTime } from "@/lib/utils"
import { formatDistance } from "@/lib/splits"
import { SplitTableLoader } from "@/components/SplitTable"
import { parseComment } from "@/components/CommentText"

type LatestRecord = {
    id: number
    name: string
    gender: string | null
    time_ms: number
    distance: number
    race_name: string
    date: string
    comment: string | null
    clever_index: number | null
    event_id: number | null
    has_splits: boolean
}

type RaceGroup = {
    key: string
    date: string
    raceName: string
    eventId: number | null
    records: LatestRecord[]
}

const MIN_GROUPS = 20

// 年度（4月始まり）の初日 YYYY-04-01
const fiscalYearStart = (today: Date) => {
    const fy = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1
    return { fy, start: `${fy}-04-01` }
}

const formatDate = (d: string) => `${d.substring(0, 4)}/${d.substring(5, 7)}/${d.substring(8, 10)}`

// 最近の記録を大会（同じ大会・同じ日）ごとにまとめて表示。
// 今年度の大会と直近 MIN_GROUPS 大会のうち、大会数が多い方を表示する
export function LatestByRace() {
    const [groups, setGroups] = useState<RaceGroup[] | null>(null)
    const [rangeLabel, setRangeLabel] = useState("")
    const [error, setError] = useState("")
    const [openSplitId, setOpenSplitId] = useState<number | null>(null)

    useEffect(() => {
        const fetchRecords = async () => {
            const supabase = createClient()
            const { data, error } = await supabase
                .from("public_results")
                .select("id, name, gender, time_ms, distance, race_name, date, comment, clever_index, event_id, has_splits")
                .not("date", "is", null)
                .order("date", { ascending: false })
                .limit(1000)
            if (error) { setError(error.message); return }

            // 日付の新しい順に大会ごとにまとめる（大会情報に紐付いていれば event_id、なければ大会名で判定）
            const byKey = new Map<string, RaceGroup>()
            for (const r of (data ?? []) as LatestRecord[]) {
                const key = `${r.date}|${r.event_id ?? r.race_name}`
                const g = byKey.get(key) ?? { key, date: r.date, raceName: r.race_name, eventId: r.event_id, records: [] }
                g.records.push(r)
                byKey.set(key, g)
            }
            const all = [...byKey.values()]
            all.forEach(g => g.records.sort((a, b) => b.distance - a.distance || a.time_ms - b.time_ms))

            const { fy, start } = fiscalYearStart(new Date())
            const thisYear = all.filter(g => g.date >= start)
            if (thisYear.length >= MIN_GROUPS) {
                setGroups(thisYear)
                setRangeLabel(`${fy}年度の大会（${thisYear.length}大会）`)
            } else {
                const recent = all.slice(0, MIN_GROUPS)
                setGroups(recent)
                setRangeLabel(`直近${recent.length}大会`)
            }
        }
        fetchRecords()
    }, [])

    if (error) return <p className="text-sm text-red-600">読み込みに失敗しました: {error}</p>
    if (!groups) return <p className="text-sm">読み込み中...</p>

    return (
        <div className="w-full max-w-4xl mx-auto flex flex-col gap-4 text-black">
            <p className="text-sm text-gray-500">{rangeLabel}</p>
            {groups.map(g => (
                <section key={g.key} className="bg-white p-2">
                    <h2 className="text-sm md:text-base font-bold mb-1">
                        <span className="mr-2">{formatDate(g.date)}</span>
                        {g.eventId != null
                            ? <Link href={`/event/${g.eventId}`} className="text-blue-600 hover:underline">{g.raceName}</Link>
                            : g.raceName}
                        <span className="ml-2 text-xs font-normal text-gray-500">{g.records.length}人</span>
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="border-collapse w-full bg-white font-mono text-[10px] md:text-sm whitespace-nowrap">
                            <thead>
                                <tr className="border-b text-left">
                                    <th className="px-1 md:px-3 py-0">名前</th>
                                    <th className="px-1 md:px-3 py-0 text-right">種目</th>
                                    <th className="px-1 md:px-3 py-0 text-right">記録</th>
                                    <th className="px-1 md:px-3 py-0 text-right" title="RUNNET のクレバー指数">クレバー</th>
                                    <th className="px-1 md:px-3 py-0 text-center">ラップ</th>
                                    <th className="px-1 md:px-3 py-0">備考</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {g.records.map(r => (
                                    <Fragment key={r.id}>
                                        <tr>
                                            <td className={`px-1 md:px-3 py-0 ${r.gender === "female" ? "text-red-600" : ""}`}>{r.name}</td>
                                            <td className="px-1 md:px-3 py-0 text-right">{formatDistance(r.distance)}</td>
                                            <td className="px-1 md:px-3 py-0 text-right">{formatTime(r.time_ms)}</td>
                                            <td className="px-1 md:px-3 py-0 text-right">{r.clever_index ?? ""}</td>
                                            <td className="px-1 md:px-3 py-0 text-center">
                                                {r.has_splits && (
                                                    <button
                                                        onClick={() => setOpenSplitId(openSplitId === r.id ? null : r.id)}
                                                        className="text-blue-600 hover:underline"
                                                        aria-expanded={openSplitId === r.id}
                                                    >
                                                        {openSplitId === r.id ? "閉じる" : "表示"}
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-1 md:px-3 py-0 whitespace-normal">{parseComment(r.comment)}</td>
                                        </tr>
                                        {openSplitId === r.id && (
                                            <tr>
                                                <td colSpan={6} className="px-1 md:px-3 pb-2">
                                                    <SplitTableLoader resultId={r.id} />
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            ))}
        </div>
    )
}
