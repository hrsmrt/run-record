"use client"

import { type ReactNode, useState } from "react"
import { type GpxPoint, type ProcessedRoute, parseGpx, processRoute } from "@/lib/gpx"
import { formatKm } from "@/lib/practices"
import { RouteMap } from "@/components/RouteMap"

// スタート・ゴール付近を消す範囲の選択肢（m）
const TRIM_OPTIONS = [0, 100, 200, 300, 500, 1000]
const MAX_GPX_BYTES = 10 * 1024 * 1024

// 選んだ GPX の状態。file があるのに route がないときは error に理由が入る
export type GpxSelection = { hasFile: boolean; route: ProcessedRoute | null; error: string }

const process = (points: GpxPoint[], trimM: number): GpxSelection => {
    try { return { hasFile: true, route: processRoute(points, trimM), error: "" } }
    catch (e) { return { hasFile: true, route: null, error: e instanceof Error ? e.message : String(e) } }
}

// GPX ファイルを選び、スタート・ゴール付近を消す範囲を決めて、保存される範囲を地図で確かめる。
// 元の点はブラウザ内だけに持ち、消す範囲を変えたら作り直して onChange で知らせる
export function GpxPicker({ defaultTrimM, onChange, kmMarkerInterval, summaryExtra }: {
    defaultTrimM: number
    onChange: (selection: GpxSelection) => void
    // 地図に付ける km の印の間隔（なしなら付けない）
    kmMarkerInterval?: number
    // 距離などの表示の横に足すもの（例:「この距離を使う」ボタン）
    summaryExtra?: (route: ProcessedRoute) => ReactNode
}) {
    const [points, setPoints] = useState<GpxPoint[] | null>(null)
    const [fileName, setFileName] = useState("")
    const [trimM, setTrimM] = useState(defaultTrimM)
    const [selection, setSelection] = useState<GpxSelection>({ hasFile: false, route: null, error: "" })

    const update = (next: GpxSelection) => { setSelection(next); onChange(next) }

    const handleFile = async (file: File | undefined) => {
        setPoints(null)
        setFileName("")
        if (!file) { update({ hasFile: false, route: null, error: "" }); return }
        if (file.size > MAX_GPX_BYTES) { update({ hasFile: true, route: null, error: "GPX ファイルは 10MB までです" }); return }
        try {
            const parsed = parseGpx(await file.text())
            setPoints(parsed)
            setFileName(file.name)
            update(process(parsed, trimM))
        } catch (e) {
            update({ hasFile: true, route: null, error: e instanceof Error ? e.message : String(e) })
        }
    }

    const handleTrim = (m: number) => {
        setTrimM(m)
        if (points) update(process(points, m))
    }

    const route = selection.route
    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3 text-sm">
                <input type="file" accept=".gpx,application/gpx+xml" onChange={e => handleFile(e.target.files?.[0])} />
                {points && (
                    <label className="flex items-center gap-1">
                        スタート・ゴールから
                        <select value={trimM} onChange={e => handleTrim(Number(e.target.value))} className="border rounded px-2 py-1 bg-white">
                            {TRIM_OPTIONS.map(m => <option key={m} value={m}>{m === 0 ? "消さない" : `${m}m`}</option>)}
                        </select>
                        以内を消す
                    </label>
                )}
            </div>
            {selection.error && <p className="text-sm text-red-600">{selection.error}</p>}
            {route && (
                <div className="flex flex-col gap-1">
                    <p className="text-sm">
                        {fileName}: 距離 {formatKm(route.distanceKm)}
                        {route.elevationGainM != null && `・累積標高 ${route.elevationGainM}m`}
                        {summaryExtra?.(route)}
                    </p>
                    <RouteMap line={route.line} kmMarkerInterval={kmMarkerInterval} className="h-64 w-full rounded border" />
                    <p className="text-xs text-gray-500">
                        地図の線が保存される範囲です。自宅などから計測を始めた場合は、スタート・ゴール付近が消えていることを確かめてください。
                        保存する GPX には位置と標高だけを入れ、時刻・心拍などは入れません。
                    </p>
                </div>
            )}
            <p className="text-xs text-gray-500">
                GPX の書き出し方: Strava はアクティビティの「…」→「GPX をエクスポート」、Garmin Connect はアクティビティの歯車 →「GPX にエクスポート」。
            </p>
        </div>
    )
}
