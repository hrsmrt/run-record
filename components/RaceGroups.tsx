"use client"

import { Fragment, useState } from "react"
import Link from "next/link"
import type { SupabaseClient } from "@supabase/supabase-js"
import { formatTime } from "@/lib/utils"
import { formatDistance } from "@/lib/splits"
import { SplitTableLoader } from "@/components/SplitTable"
import { parseComment } from "@/components/CommentText"

export type GroupRecord = {
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
    category: string
}

// 同じ大会・同じ日の記録のまとまり
export type RaceGroup = {
    key: string
    date: string
    raceName: string
    eventId: number | null
    records: GroupRecord[]
    // 大会レポート（大会情報に紐付いた大会のみ）
    report: { editionId: number; count: number } | null
}

// Supabase が1回に返す最大件数（これより多いときは続きを取得する）
const PAGE_SIZE = 1000

export const formatDate = (d: string) => `${d.substring(0, 4)}/${d.substring(5, 7)}/${d.substring(8, 10)}`

// 年度（4月始まり）。日付文字列 YYYY-MM-DD から
export const fiscalYearOf = (date: string) => {
    const y = Number(date.substring(0, 4))
    return Number(date.substring(5, 7)) >= 4 ? y : y - 1
}

// 全記録を大会（同じ大会・同じ日）ごとにまとめ、日付の新しい順に返す
export async function fetchRaceGroups(supabase: SupabaseClient): Promise<RaceGroup[]> {
    const records: GroupRecord[] = []
    for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
            .from("public_results")
            .select("id, name, gender, time_ms, distance, race_name, date, comment, clever_index, event_id, has_splits, category")
            .not("date", "is", null)
            .order("date", { ascending: false })
            .order("id")
            .range(from, from + PAGE_SIZE - 1)
        if (error) throw new Error(error.message)
        records.push(...(data ?? []) as GroupRecord[])
        if ((data ?? []).length < PAGE_SIZE) break
    }
    const { data: reportData } = await supabase.from("public_race_reports").select("event_edition_id, event_id, held_on")

    // 大会レポートを「開催日|大会ID」ごとに数える
    const reportsByKey = new Map<string, { editionId: number; count: number }>()
    for (const rp of reportData ?? []) {
        const k = `${rp.held_on}|${rp.event_id}`
        const cur = reportsByKey.get(k)
        reportsByKey.set(k, { editionId: rp.event_edition_id, count: (cur?.count ?? 0) + 1 })
    }

    // 大会情報に紐付いていれば event_id、なければ大会名で同じ大会と判定
    const byKey = new Map<string, RaceGroup>()
    for (const r of records) {
        const key = `${r.date}|${r.event_id ?? r.race_name}`
        const g = byKey.get(key) ?? {
            key, date: r.date, raceName: r.race_name, eventId: r.event_id, records: [],
            report: r.event_id != null ? reportsByKey.get(`${r.date}|${r.event_id}`) ?? null : null,
        }
        g.records.push(r)
        byKey.set(key, g)
    }
    const groups = [...byKey.values()]
    groups.forEach(g => g.records.sort((a, b) => b.distance - a.distance || a.time_ms - b.time_ms))
    return groups
}

// 大会名（詳細ページへのリンク）とレポート件数
export function RaceGroupTitle({ group }: { group: RaceGroup }) {
    return (
        <>
            {group.eventId != null
                ? <Link href={`/event/${group.eventId}`} className="text-blue-600 hover:underline">{group.raceName}</Link>
                : group.raceName}
            {group.report && group.eventId != null && (
                <Link
                    href={`/event/${group.eventId}#edition-${group.report.editionId}`}
                    className="ml-3 text-xs font-normal text-blue-600 hover:underline"
                >
                    レポート {group.report.count}件
                </Link>
            )}
        </>
    )
}

// 1つの大会の記録の表（種目の長い順・タイム順）
export function RaceGroupRecords({ records }: { records: GroupRecord[] }) {
    const [openSplitId, setOpenSplitId] = useState<number | null>(null)
    return (
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
                    {records.map(r => (
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
    )
}
