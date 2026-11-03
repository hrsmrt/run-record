"use client"

import { useState } from "react"
import { LineChart } from "@mui/x-charts/LineChart"
import { SplitPoint, pointLabel } from "@/lib/splits"

export type GapRunner = {
    id: number
    name: string
    timeMs: number
    points: SplitPoint[]
}

// 線の色（決まった順で割り当て、基準を切り替えても人ごとの色は変えない）
// 白背景で色覚の違いを含めて検証済み。緑・黄・ピンクは背景とのコントラストが低いため、点・凡例・表で補う
const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"]

// 秒 → "1:23"（符号なし）
const formatGap = (sec: number) => {
    const s = Math.round(Math.abs(sec))
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

// スタートのロスを引いたネット通過タイムの一覧（0km を含む、距離順）
const netPoints = (points: SplitPoint[]) => {
    const startMs = points.find(p => p.km === 0)?.ms ?? 0
    const net = points.filter(p => p.km > 0).map(p => ({ km: p.km, ms: p.ms - startMs }))
    return [{ km: 0, ms: 0 }, ...net].sort((a, b) => a.km - b.km)
}

// 基準の人の、任意の地点でのネット通過タイム（前後の地点から直線で見積もる。範囲外は null）
const interpolate = (ref: { km: number; ms: number }[], km: number): number | null => {
    for (let i = 1; i < ref.length; i++) {
        const a = ref[i - 1], b = ref[i]
        if (km >= a.km && km <= b.km) {
            if (b.km === a.km) return b.ms
            return a.ms + (b.ms - a.ms) * (km - a.km) / (b.km - a.km)
        }
    }
    return null
}

// 同じ種目でラップを登録した人どうしの「基準の人との差」の推移
export function RaceGapChart({ runners }: { runners: GapRunner[] }) {
    // ゴールタイム順。色はこの順で固定する
    const shown = [...runners].sort((a, b) => a.timeMs - b.timeMs).slice(0, SERIES_COLORS.length)
    const [refId, setRefId] = useState(shown[0]?.id)
    const ref = shown.find(r => r.id === refId) ?? shown[0]
    if (shown.length < 2 || !ref) return null

    const refNet = netPoints(ref.points)
    // 各人の、自分の通過地点での差（秒）。正 = 基準より遅れ
    const gaps = shown.map(r => {
        const byKm = new Map<number, number>()
        for (const p of netPoints(r.points)) {
            if (p.km === 0) continue
            const refMs = interpolate(refNet, p.km)
            if (refMs !== null) byKm.set(p.km, (p.ms - refMs) / 1000)
        }
        return byKm
    })
    const xs = [...new Set(gaps.flatMap(g => [...g.keys()]))].sort((a, b) => a - b)
    if (xs.length === 0) return null

    return (
        <div className="mt-2">
            <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm mb-1">
                <span className="font-bold text-gray-600">基準の人との差</span>
                <label className="flex items-center gap-1">
                    基準:
                    <select
                        value={ref.id}
                        onChange={e => setRefId(Number(e.target.value))}
                        className="border rounded px-1 py-0.5 bg-white"
                    >
                        {shown.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                </label>
                <span className="text-gray-500">上が先行・下が遅れ（ネットタイムで比較）</span>
                {runners.length > shown.length && (
                    <span className="text-gray-500">※ 記録の速い{shown.length}人まで表示</span>
                )}
            </div>
            <div className="overflow-x-auto">
                <div className="min-w-[480px]">
                    <LineChart
                        height={280}
                        xAxis={[{
                            data: xs,
                            scaleType: "linear",
                            min: 0,
                            valueFormatter: (km: number) => pointLabel(km),
                        }]}
                        yAxis={[{
                            reverse: true,
                            valueFormatter: (sec: number) => sec === 0 ? "0" : `${sec > 0 ? "+" : "-"}${formatGap(sec)}`,
                        }]}
                        series={shown.map((r, i) => ({
                            id: String(r.id),
                            label: r.name,
                            color: SERIES_COLORS[i],
                            data: xs.map(x => gaps[i].get(x) ?? null),
                            connectNulls: true,
                            showMark: true,
                            valueFormatter: (v: number | null) =>
                                v === null ? "" : Math.abs(v) < 0.5 ? "同タイム" : `${formatGap(v)} ${v > 0 ? "遅れ" : "先行"}`,
                        }))}
                        grid={{ horizontal: true }}
                    />
                </div>
            </div>
        </div>
    )
}
