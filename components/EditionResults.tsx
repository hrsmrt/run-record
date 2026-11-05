"use client"

import { Fragment, useState } from "react"
import { formatTime } from "@/lib/utils"
import { SplitPoint } from "@/lib/splits"
import { SplitTable } from "@/components/SplitTable"
import { RaceGapChart } from "@/components/RaceGapChart"
import { formatRank } from "@/lib/ranks"

export type EventResult = {
    id: number
    name: string
    gender: string | null
    time_ms: number
    clever_index: number | null
    race_id: number
    overall_rank: number | null
    overall_total: number | null
    gender_rank: number | null
    gender_total: number | null
    division: string | null
    division_rank: number | null
    division_total: number | null
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
    const raceById = new Map(races.map(r => [r.id, r]))

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
        const diff = sortKey === "name" ? a.name.localeCompare(b.name) : a.time_ms - b.time_ms
        return (sortAsc ? 1 : -1) * diff
    }

    // 種目（距離の長い順）ごとのまとまりは保ち、その中で選んだ列で並べる
    const sorted = [...results].sort((a, b) =>
        (raceById.get(b.race_id)?.distance_km ?? 0) - (raceById.get(a.race_id)?.distance_km ?? 0)
        || compareBy(a, b)
        || a.time_ms - b.time_ms)

    if (sorted.length === 0) return null
    // 順位を入力した人がいるときだけ順位の列を出す
    const hasRank = sorted.some(r => r.overall_rank != null || r.gender_rank != null || r.division_rank != null)
    const columns = hasRank ? 8 : 5

    return (
        <div className="mt-2">
            <h4 className="text-xs font-bold text-gray-600 mb-1">参加者の記録</h4>
            <div className="bg-white text-black p-2 text-[8px] md:text-base">
                <div className="overflow-x-auto">
                    <table className="border-collapse w-full text-black bg-white font-mono whitespace-nowrap">
                        <thead>
                            <tr className="bg-white border-b">
                                <th className="px-1 md:px-3 py-0 text-left">種目</th>
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
                            {sorted.map(r => {
                                const points = splits.get(r.id) ?? []
                                const open = openId === r.id
                                return (
                                    <Fragment key={r.id}>
                                        <tr>
                                            <td className="px-1 md:px-3 py-0">{raceById.get(r.race_id)?.name ?? ""}</td>
                                            <td className={`px-1 md:px-3 py-0 ${r.gender === "female" ? "text-red-600" : ""}`}>{r.name}</td>
                                            <td className="px-1 md:px-3 py-0 text-right">{formatTime(r.time_ms)}</td>
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
            {/* ラップを登録した人が2人以上いる種目は、人との差をグラフで表示 */}
            {[...races].sort((a, b) => b.distance_km - a.distance_km).map(race => {
                const runners = sorted
                    .filter(r => r.race_id === race.id && (splits.get(r.id)?.length ?? 0) > 0)
                    .map(r => ({ id: r.id, name: r.name, timeMs: r.time_ms, points: splits.get(r.id)! }))
                if (runners.length < 2) return null
                return (
                    <div key={race.id} className="mt-3 bg-white p-2">
                        {races.length > 1 && <p className="text-xs font-bold mb-1">{race.name}</p>}
                        <RaceGapChart runners={runners} distanceKm={race.distance_km} />
                    </div>
                )
            })}
        </div>
    )
}
