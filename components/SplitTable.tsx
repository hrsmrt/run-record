"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { SplitPoint, computeLaps, formatElapsed, formatPace, pointLabel } from "@/lib/splits"

// 通過地点ごとの通過・ネット・区間・ペースの表
export function SplitTable({ points }: { points: SplitPoint[] }) {
    const laps = computeLaps(points)
    // 通過順位は入力した人だけ列を出す
    const hasRank = points.some(p => p.rank != null)
    return (
        <table className="ml-4 my-1 border-collapse text-gray-700 bg-gray-50">
            <thead>
                <tr className="border-b">
                    <th className="px-2 py-0 text-left">地点</th>
                    <th className="px-2 py-0 text-right">通過</th>
                    <th className="px-2 py-0 text-right">ネット</th>
                    <th className="px-2 py-0 text-right">区間</th>
                    <th className="px-2 py-0 text-right">ペース</th>
                    {hasRank && <th className="px-2 py-0 text-right">通過順位</th>}
                </tr>
            </thead>
            <tbody>
                {laps.map(l => (
                    <tr key={l.km}>
                        <td className="px-2 py-0">{l.km === 0 ? "スタート（ロス）" : pointLabel(l.km)}</td>
                        <td className="px-2 py-0 text-right">{formatElapsed(l.ms)}</td>
                        <td className="px-2 py-0 text-right">{l.netMs !== null ? formatElapsed(l.netMs) : ""}</td>
                        <td className="px-2 py-0 text-right">{l.lapMs !== null ? formatElapsed(l.lapMs) : ""}</td>
                        <td className="px-2 py-0 text-right">{l.paceMsPerKm !== null ? formatPace(l.paceMsPerKm) : ""}</td>
                        {hasRank && <td className="px-2 py-0 text-right">{l.rank != null ? `${l.rank.toLocaleString()}位` : ""}</td>}
                    </tr>
                ))}
            </tbody>
        </table>
    )
}

// 表示されたときに1件分のラップを取得して SplitTable を出す
export function SplitTableLoader({ resultId }: { resultId: number }) {
    const [points, setPoints] = useState<SplitPoint[] | null>(null)
    const [error, setError] = useState("")

    useEffect(() => {
        const fetch = async () => {
            const supabase = createClient()
            const { data, error } = await supabase
                .from("result_splits")
                .select("distance_km, elapsed_ms, rank")
                .eq("result_id", resultId)
            if (error) { setError(error.message); return }
            setPoints((data ?? []).map(s => ({ km: Number(s.distance_km), ms: s.elapsed_ms, rank: s.rank })))
        }
        fetch()
    }, [resultId])

    if (error) return <p className="ml-4 text-red-600">ラップの読み込みに失敗しました</p>
    if (!points) return <p className="ml-4 text-gray-500">読み込み中...</p>
    return <SplitTable points={points} />
}
