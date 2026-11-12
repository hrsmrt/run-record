"use client"

import { Fragment, useState } from "react"
import { type ResultStatus, compareResult, formatResult, isFinished } from "@/lib/result-status"
import { SplitPoint, formatDistance } from "@/lib/splits"
import { SplitTable } from "@/components/SplitTable"
import { RaceGapChart } from "@/components/RaceGapChart"
import { formatRank } from "@/lib/ranks"
import { EnrollmentTag } from "@/components/EnrollmentTag"

export type EventResult = {
    id: number
    name: string
    gender: string | null
    time_ms: number | null
    status: ResultStatus
    dnf_km: number | null
    clever_index: number | null
    race_id: number
    overall_rank: number | null
    overall_total: number | null
    gender_rank: number | null
    gender_total: number | null
    division: string | null
    division_rank: number | null
    division_total: number | null
    enrollment_year: number | null
    // 本人以外（記録係・管理者）が登録した記録は、登録した人の名前
    entered_by_name: string | null
}

type RaceInfo = { id: number; name: string; distance_km: number }

type SortKey = "name" | "time" | "clever" | "rank"

// 開催回の種目ごとに、知人の記録と（あれば）ラップを表示する
export function EditionResults({ races, results, splits }: {
    races: RaceInfo[]
    results: EventResult[]
    splits: Map<number, SplitPoint[]>
}) {
    const [openId, setOpenId] = useState<number | null>(null)
    const [sortKey, setSortKey] = useState<SortKey>("clever")
    const [sortAsc, setSortAsc] = useState(false)

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortAsc(!sortAsc)
        // クレバー指数は高いほど良いので、最初は高い順（降順）
        else { setSortKey(key); setSortAsc(key !== "clever") }
    }
    const arrow = (key: SortKey) => sortKey === key ? (sortAsc ? " ↑" : " ↓") : ""

    // 選んだ列で並べた比較結果（クレバー指数・順位がない記録は昇降順どちらでも最後）
    const compareBy = (a: EventResult, b: EventResult) => {
        if (sortKey === "clever" || sortKey === "rank") {
            const va = sortKey === "clever" ? a.clever_index : a.overall_rank
            const vb = sortKey === "clever" ? b.clever_index : b.overall_rank
            if (va == null || vb == null) return va == null ? (vb == null ? 0 : 1) : -1
            return (sortAsc ? 1 : -1) * (va - vb)
        }
        // 記録順: 完走以外（DNF・DNS など）は向きに関係なく下にまとめる
        if (sortKey !== "name" && (!isFinished(a) || !isFinished(b))) return compareResult(a, b)
        const diff = sortKey === "name" ? a.name.localeCompare(b.name) : a.time_ms! - b.time_ms!
        return (sortAsc ? 1 : -1) * diff
    }

    // 種目（距離の長い順）ごとに表を分け、その中で選んだ列で並べる（並べ替えはすべての種目に共通）
    const groups = [...races]
        .sort((a, b) => b.distance_km - a.distance_km)
        .map(race => ({ race, rows: results.filter(r => r.race_id === race.id).sort((a, b) => compareBy(a, b) || compareResult(a, b)) }))
        .filter(g => g.rows.length > 0)

    if (groups.length === 0) return null

    return (
        <div className="mt-2 flex flex-col gap-3">
            <h4 className="text-xs font-bold text-gray-600">参加者の記録</h4>
            {groups.map(({ race, rows }) => {
                // 順位を入力した人がいる種目だけ順位の列を出す
                const hasRank = rows.some(r => r.overall_rank != null || r.gender_rank != null || r.division_rank != null)
                const columns = hasRank ? 7 : 4
                // ラップを登録した人が2人以上いれば、人との差をグラフで表示（ゴールタイムが要るので完走した人だけ）
                const runners = rows
                    .filter(r => isFinished(r) && r.time_ms != null && (splits.get(r.id)?.length ?? 0) > 0)
                    .map(r => ({ id: r.id, name: r.name, timeMs: r.time_ms!, points: splits.get(r.id)! }))
                return (
                    <section key={race.id} className="flex flex-col gap-1">
                        <h5 className="text-sm font-bold">
                            {race.name}
                            <span className="ml-2 text-xs font-normal text-gray-500">{formatDistance(race.distance_km)}・{rows.length}人</span>
                        </h5>
                        <div className="bg-white text-black p-2 text-[8px] md:text-base">
                            <div className="overflow-x-auto">
                                <table className="border-collapse w-full text-black bg-white font-mono whitespace-nowrap">
                                        <thead>
                                            <tr className="bg-white border-b">
                                                <th className="px-1 md:px-3 py-0 text-left cursor-pointer" onClick={() => handleSort("name")}>
                                                    名前{arrow("name")}
                                                </th>
                                                <th className="px-1 md:px-3 py-0 text-right cursor-pointer" onClick={() => handleSort("time")}>
                                                    記録{arrow("time")}
                                                </th>
                                                <th
                                                    className="px-1 md:px-3 py-0 text-right cursor-pointer"
                                                    onClick={() => handleSort("clever")}
                                                    title="RUNNET のクレバー指数"
                                                >
                                                    クレバー{arrow("clever")}
                                                </th>
                                                {hasRank && (
                                                    <>
                                                        <th className="px-1 md:px-3 py-0 text-right cursor-pointer" onClick={() => handleSort("rank")}>
                                                            総合{arrow("rank")}
                                                        </th>
                                                        <th className="px-1 md:px-3 py-0 text-right">男女別</th>
                                                        <th className="px-1 md:px-3 py-0 text-left">部門</th>
                                                    </>
                                                )}
                                                <th className="px-1 md:px-3 py-0 text-center">ラップ</th>
                                            </tr>
                                        </thead>
                                    <tbody className="divide-y divide-gray-200">
                                            {rows.map(r => {
                                                const points = splits.get(r.id) ?? []
                                                const open = openId === r.id
                                                return (
                                                    <Fragment key={r.id}>
                                                        <tr>
                                                            <td className={`px-1 md:px-3 py-0 ${r.gender === "female" ? "text-red-600" : ""}`}>{r.name}<EnrollmentTag year={r.enrollment_year} />{r.entered_by_name && <span className="ml-1 text-[0.75em] text-gray-400" title="本人以外が登録した記録">登録: {r.entered_by_name}</span>}</td>
                                                            <td className="px-1 md:px-3 py-0 text-right">{formatResult(r)}</td>
                                                            <td className="px-1 md:px-3 py-0 text-right">{r.clever_index ?? ""}</td>
                                                            {hasRank && (
                                                                <>
                                                                    <td className="px-1 md:px-3 py-0 text-right">{formatRank(r.overall_rank, r.overall_total)}</td>
                                                                    <td className="px-1 md:px-3 py-0 text-right">{formatRank(r.gender_rank, r.gender_total)}</td>
                                                                    <td className="px-1 md:px-3 py-0">
                                                                        {r.division ?? ""}{r.division && r.division_rank != null && " "}{formatRank(r.division_rank, r.division_total)}
                                                                    </td>
                                                                </>
                                                            )}
                                                            <td className="px-1 md:px-3 py-0 text-center">
                                                                {points.length > 0 && (
                                                                    <button
                                                                        onClick={() => setOpenId(open ? null : r.id)}
                                                                        className="text-blue-600 hover:underline"
                                                                        aria-expanded={open}
                                                                    >
                                                                        {open ? "閉じる" : "表示"}
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                        {open && (
                                                            <tr>
                                                                <td colSpan={columns} className="px-1 md:px-3 pb-2">
                                                                    <SplitTable points={points} />
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </Fragment>
                                                )
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        {runners.length >= 2 && (
                            <div className="bg-white p-2">
                                <RaceGapChart runners={runners} distanceKm={race.distance_km} />
                            </div>
                        )}
                    </section>
                )
            })}
        </div>
    )
}
