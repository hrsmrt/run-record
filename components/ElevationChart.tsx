"use client"

import { LineChart } from "@mui/x-charts/LineChart"
import type { RoutePoint } from "@/lib/gpx"

// 高低差のグラフ（横軸はスタートからの距離）。標高のない GPX では表示しない
export function ElevationChart({ line }: { line: RoutePoint[] }) {
    const points = line.filter(p => p[2] != null)
    if (points.length < 2) return null
    const eles = points.map(p => p[2] as number)
    const min = Math.min(...eles)
    const max = Math.max(...eles)
    // 高低差が小さいときも平らに見えすぎないよう、上下に少し余白を取る
    const pad = Math.max(10, (max - min) * 0.1)
    return (
        <LineChart
            height={200}
            margin={{ left: 10, right: 20, top: 10, bottom: 10 }}
            xAxis={[{ data: points.map(p => p[3]), label: "km", valueFormatter: (v: number) => `${v.toFixed(1)}km`, tickMinStep: 1 }]}
            yAxis={[{ min: Math.floor(min - pad), max: Math.ceil(max + pad), label: "標高(m)" }]}
            series={[{ data: eles, area: true, showMark: false, color: "#16a34a", valueFormatter: v => v == null ? "" : `${Math.round(v)}m` }]}
            grid={{ horizontal: true }}
        />
    )
}
