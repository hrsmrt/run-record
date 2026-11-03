"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { LineChart } from "@mui/x-charts/LineChart"
import { ChartsTooltipContainer, ChartsTooltipContainerProps, useAxesTooltip } from "@mui/x-charts/ChartsTooltip"
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
// 9人目以降は色を増やさず、同じ8色に線の種類（破線・点線）を組み合わせて区別する
const DASHES = [undefined, "6 3", "1.5 3"] as const

type LineStyle = { color: string; dash: string | undefined }

// 記録順 i 番目の人の線の色と種類
const lineStyleAt = (i: number): LineStyle => ({
    color: SERIES_COLORS[i % SERIES_COLORS.length],
    dash: DASHES[Math.floor(i / SERIES_COLORS.length) % DASHES.length],
})

// ツールチップ・凡例で線の種類を参照するための受け渡し（キーは系列 ID）
const LineStyleContext = createContext<Map<string, LineStyle>>(new Map())

// 凡例・ツールチップ用の線の見本
function LineSample({ style }: { style: LineStyle }) {
    return (
        <svg width="22" height="8" className="inline-block align-middle mr-1" aria-hidden="true">
            <line x1="1" y1="4" x2="21" y2="4" stroke={style.color} strokeWidth="2.5" strokeDasharray={style.dash} />
        </svg>
    )
}

// 秒 → "1:23"（符号なし）
const formatGap = (sec: number) => {
    const s = Math.round(Math.abs(sec))
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

type Basis = "net" | "gross"

// 差（秒）の表示文。正 = 遅れ
const gapText = (v: number) => Math.abs(v) < 0.5 ? "基準と同タイム" : `${formatGap(v)} ${v > 0 ? "遅れ" : "先行"}`

// ホバー・タップした地点での順位つき一覧（その地点に通過タイムがある人のみ）
function RankTooltip(props: ChartsTooltipContainerProps) {
    const tooltips = useAxesTooltip({ directions: ["x"] })
    const styles = useContext(LineStyleContext)
    if (!tooltips || tooltips.length === 0) return null
    const { axisValue, seriesItems } = tooltips[0]
    const ranked = seriesItems
        .filter(it => typeof it.value === "number")
        .sort((a, b) => (a.value as number) - (b.value as number))
    if (ranked.length === 0) return null
    return (
        <ChartsTooltipContainer {...props}>
            <div className="bg-white text-black border rounded shadow-md p-2 text-xs md:text-sm">
                <p className="font-bold mb-1">{pointLabel(Number(axisValue))} 時点</p>
                <table>
                    <tbody>
                        {ranked.map((it, i) => (
                            <tr key={String(it.seriesId)}>
                                <td className="pr-2 text-right">{i + 1}位</td>
                                <td className="pr-2">
                                    <LineSample style={styles.get(String(it.seriesId)) ?? { color: it.color, dash: undefined }} />
                                    {it.formattedLabel}
                                </td>
                                <td className="text-right font-mono">{gapText(it.value as number)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </ChartsTooltipContainer>
    )
}

// タッチ操作の端末か（指でツールチップが隠れないよう、表示位置を変える）
function useCoarsePointer() {
    const [coarse, setCoarse] = useState(false)
    useEffect(() => {
        const mq = window.matchMedia("(pointer: coarse)")
        setCoarse(mq.matches)
        const onChange = (e: MediaQueryListEvent) => setCoarse(e.matches)
        mq.addEventListener("change", onChange)
        return () => mq.removeEventListener("change", onChange)
    }, [])
    return coarse
}

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
    // ラップのある人全員をゴールタイム順に。線の色・種類はこの順で固定する
    const shown = [...runners].sort((a, b) => a.timeMs - b.timeMs)
    const styles = new Map(shown.map((r, i) => [String(r.id), lineStyleAt(i)]))
    const [refId, setRefId] = useState(shown[0]?.id)
    const [basis, setBasis] = useState<Basis>("net")
    const coarsePointer = useCoarsePointer()
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
            </div>
            <LineStyleContext.Provider value={styles}>
            <div className="overflow-x-auto">
                <div className="min-w-[480px]">
                    <LineChart
                        height={280}
                        // 標準の凡例は線の種類を表せないため、下に自作の凡例を出す
                        hideLegend
                        // 9人目以降の破線・点線（線の要素には data-series に系列 ID が入る）
                        sx={Object.fromEntries(shown.flatMap(r => {
                            const dash = styles.get(String(r.id))!.dash
                            return dash ? [[`& .MuiLineChart-line[data-series="${r.id}"]`, { strokeDasharray: dash }]] : []
                        }))}
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
                            color: styles.get(String(r.id))!.color,
                            data: xs.map(x => gaps[i].get(x) ?? null),
                            connectNulls: true,
                            showMark: true,
                            valueFormatter: (v: number | null) => v === null ? "" : gapText(v),
                        }))}
                        slots={{ tooltip: RankTooltip }}
                        slotProps={{
                            // スマホはグラフの上端に固定して指と重ならないように、PC はポインタの少し上に表示
                            tooltip: coarsePointer
                                ? { trigger: "axis", anchor: "chart", position: "top" }
                                : {
                                    trigger: "axis",
                                    anchor: "pointer",
                                    position: "top",
                                    modifiers: [{ name: "offset", options: { offset: [0, 16] } }],
                                },
                        }}
                        grid={{ horizontal: true }}
                    />
                </div>
            </div>
            <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs md:text-sm">
                {shown.map(r => (
                    <li key={r.id} className="whitespace-nowrap">
                        <LineSample style={styles.get(String(r.id))!} />
                        {r.name}
                    </li>
                ))}
            </ul>
            </LineStyleContext.Provider>
        </div>
    )
}
