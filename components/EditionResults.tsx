"use client"

import { Fragment, useState } from "react"
import { formatTime } from "@/lib/utils"
import { SplitPoint } from "@/lib/splits"
import { SplitTable } from "@/components/SplitTable"

export type EventResult = {
    id: number
    name: string
    gender: string | null
    time_ms: number
    clever_index: number | null
    race_id: number
}

type RaceInfo = { id: number; name: string; distance_km: number }

// 開催回の種目ごとに、知人の記録と（あれば）ラップを表示する
export function EditionResults({ races, results, splits }: {
    races: RaceInfo[]
    results: EventResult[]
    splits: Map<number, SplitPoint[]>
}) {
    const [openId, setOpenId] = useState<number | null>(null)
    const raceById = new Map(races.map(r => [r.id, r]))

    // 種目は距離の長い順、同じ種目内はタイム順
    const sorted = [...results].sort((a, b) =>
        (raceById.get(b.race_id)?.distance_km ?? 0) - (raceById.get(a.race_id)?.distance_km ?? 0)
        || a.time_ms - b.time_ms)

    if (sorted.length === 0) return null

    return (
        <div className="mt-2">
            <h4 className="text-xs font-bold text-gray-600 mb-1">参加者の記録</h4>
            <div className="bg-white text-black p-2 text-[8px] md:text-base">
                <div className="overflow-x-auto">
                    <table className="border-collapse w-full text-black bg-white font-mono whitespace-nowrap">
                        <thead>
                            <tr className="bg-white border-b">
                                <th className="px-1 md:px-3 py-0 text-left">種目</th>
                                <th className="px-1 md:px-3 py-0 text-left">名前</th>
                                <th className="px-1 md:px-3 py-0 text-right">記録</th>
                                <th className="px-1 md:px-3 py-0 text-right" title="RUNNET のクレバー指数">クレバー</th>
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
                                                <td colSpan={5} className="px-1 md:px-3 pb-2">
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
        </div>
    )
}
