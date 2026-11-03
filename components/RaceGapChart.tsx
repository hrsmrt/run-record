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

type Basis = "net" | "gross"

// スタートのロス（号砲 → スタートライン通過）。スタート行がなければ 0
const startLoss = (points: SplitPoint[]) => points.find(p => p.km === 0)?.ms ?? 0

// 通過タイムの一覧（0km を含む、距離順）
// ネット: スタートライン通過からの時間（スタートは 0）、グロス: 号砲からの時間（スタートはロス）
const basisPoints = (points: SplitPoint[], basis: Basis) => {
    const loss = startLoss(points)
    const after = points.filter(p => p.km > 0).map(p => ({ km: p.km, ms: basis === "net" ? p.ms - loss : p.ms }))
    return [{ km: 0, ms: basis === "net" ? 0 : loss }, ...after].sort((a, b) => a.km - b.km)
}

// 同じ種目でラップを登録した人どうしを、基準ペース（初期値は最速の人の平均ペース）との差で比較する
export function RaceGapChart({ runners, distanceKm }: { runners: GapRunner[]; distanceKm: number }) {
    // ゴールタイム順。色はこの順で固定する
    const shown = [...runners].sort((a, b) => a.timeMs - b.timeMs).slice(0, SERIES_COLORS.length)
    const [refId, setRefId] = useState(shown[0]?.id)
    const [basis, setBasis] = useState<Basis>("net")
    const ref = shown.find(r => r.id === refId) ?? shown[0]
    if (shown.length < 2 || !ref) return null

    // 基準: 選んだ人のゴールタイムを距離で割った平均ペースで、ゴールまで均等に走った場合の通過タイム
    // （記録はネット。グロスでは基準の人のロスを足したタイムを使う）
    const refFinishMs = basis === "net" ? ref.timeMs : ref.timeMs + startLoss(ref.points)
    const refPaceMsPerKm = refFinishMs / distanceKm
    // 各人の、自分の通過地点での差（秒）。正 = 基準ペースより遅れ
    const gaps = shown.map(r => {
        const byKm = new Map<number, number>()
        // スタート（0km）も含めて、全員の線をスタートから結ぶ（グロスはロスの分だけ遅れて始まる）
        for (const p of basisPoints(r.points, basis)) {
            byKm.set(p.km, (p.ms - refPaceMsPerKm * p.km) / 1000)
        }
        return byKm
    })
    const xs = [...new Set(gaps.flatMap(g => [...g.keys()]))].sort((a, b) => a - b)
    // スタートの点しかない（通過地点が未入力）ならグラフを出さない
    if (xs.length <= 1) return null

    return (
        <div className="mt-2">
            <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm mb-1">
                <span className="font-bold text-gray-600">基準ペースとの差</span>
                <label className="flex items-center gap-1">
                    基準ペース:
                    <select
                        value={ref.id}
                        onChange={e => setRefId(Number(e.target.value))}
                        className="border rounded px-1 py-0.5 bg-white"
                    >
                        {shown.map(r => <option key={r.id} value={r.id}>{r.name}の平均ペース</option>)}
                    </select>
                </label>
                <div className="flex rounded border overflow-hidden" role="group" aria-label="比較するタイム">
                    {(["net", "gross"] as const).map(b => (
                        <button
                            key={b}
                            onClick={() => setBasis(b)}
                            aria-pressed={basis === b}
                            className={`px-2 py-0.5 ${basis === b ? "bg-blue-600 text-white" : "bg-white hover:bg-gray-100"}`}
                        >
                            {b === "net" ? "ネット" : "グロス"}
                        </button>
                    ))}
                </div>
                <span className="text-gray-500">
                    上が先行・下が遅れ。0 は基準ペースで均等に走った場合
                    {basis === "net" ? "（スタートライン通過から）" : "（号砲から。スタートはロスの分だけ遅れて始まる）"}
                </span>
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
