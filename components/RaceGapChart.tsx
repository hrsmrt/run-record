"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { LineChart } from "@mui/x-charts/LineChart"
import { ChartsTooltipContainer, ChartsTooltipContainerProps, useAxesTooltip } from "@mui/x-charts/ChartsTooltip"
import { SplitPoint, formatElapsed, pointLabel } from "@/lib/splits"

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
// gap: 基準ペースとの差、rank: メンバー内の順位
type Mode = "gap" | "rank"

// 差（秒）の表示文。正 = 遅れ
const gapText = (v: number) => Math.abs(v) < 0.5 ? "基準と同タイム" : `${formatGap(v)} ${v > 0 ? "遅れ" : "先行"}`

// value は小さいほど前（差の秒数または順位）、text は表示する値
type RankItem = { id: string; name: string; value: number; text: string }

// ある地点での順位つき一覧（その地点に通過タイムがある人のみ、前にいる順。同タイムは同順位）
function RankList({ km, items }: { km: number; items: RankItem[] }) {
    const styles = useContext(LineStyleContext)
    const ranked = [...items].sort((a, b) => a.value - b.value)
    const rankOf = (v: number) => 1 + items.filter(it => it.value < v).length
    return (
        <div className="bg-white/95 text-black border rounded shadow-md p-2 text-xs md:text-sm">
            <p className="font-bold mb-1">{pointLabel(km)} 時点</p>
            <table>
                <tbody>
                    {ranked.map(it => (
                        <tr key={it.id}>
                            <td className="pr-2 text-right">{rankOf(it.value)}位</td>
                            <td className="pr-2 whitespace-nowrap">
                                {styles.get(it.id) && <LineSample style={styles.get(it.id)!} />}
                                {it.name}
                            </td>
                            <td className="text-right font-mono whitespace-nowrap">{it.text}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

// PC のホバー用ツールチップ
function RankTooltip(props: ChartsTooltipContainerProps) {
    const tooltips = useAxesTooltip({ directions: ["x"] })
    if (!tooltips || tooltips.length === 0) return null
    const { axisValue, seriesItems } = tooltips[0]
    const items = seriesItems
        .filter(it => typeof it.value === "number")
        .map(it => ({ id: String(it.seriesId), name: it.formattedLabel ?? "", value: it.value as number, text: it.formattedValue ?? "" }))
    if (items.length === 0) return null
    return (
        <ChartsTooltipContainer {...props}>
            <RankList km={Number(axisValue)} items={items} />
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

// ゴールの通過タイム（ゴール地点のラップがなければ記録から補う。記録はネット）
const withFinish = (points: { km: number; ms: number }[], r: GapRunner, basis: Basis, distanceKm: number) =>
    points.some(p => Math.abs(p.km - distanceKm) < 0.001)
        ? points
        : [...points, { km: distanceKm, ms: basis === "net" ? r.timeMs : r.timeMs + startLoss(r.points) }]

// 押した方が選ばれる切り替えボタン
function Toggle<T extends string>({ label, value, options, onChange }: {
    label: string
    value: T
    options: [T, string][]
    onChange: (v: T) => void
}) {
    return (
        <div className="flex rounded border overflow-hidden" role="group" aria-label={label}>
            {options.map(([v, text]) => (
                <button
                    key={v}
                    onClick={() => onChange(v)}
                    aria-pressed={value === v}
                    className={`px-2 py-0.5 ${value === v ? "bg-blue-600 text-white" : "bg-white hover:bg-gray-100"}`}
                >
                    {text}
                </button>
            ))}
        </div>
    )
}

// 同じ種目でラップを登録した人どうしを比較する
// 差: 基準ペース（初期値は最速の人の平均ペース）との差、順位: ラップのある人の中での各地点の順位
export function RaceGapChart({ runners, distanceKm }: { runners: GapRunner[]; distanceKm: number }) {
    // ラップのある人全員をゴールタイム順に。線の色・種類はこの順で固定する
    const shown = [...runners].sort((a, b) => a.timeMs - b.timeMs)
    const styles = new Map(shown.map((r, i) => [String(r.id), lineStyleAt(i)]))
    const [refId, setRefId] = useState(shown[0]?.id)
    const [basis, setBasis] = useState<Basis>("net")
    const [mode, setMode] = useState<Mode>("gap")
    const coarsePointer = useCoarsePointer()
    // スマホでタップした地点（横軸のデータ番号）。もう一度タップで閉じる
    const [tappedIndex, setTappedIndex] = useState<number | null>(null)
    const ref = shown.find(r => r.id === refId) ?? shown[0]
    if (shown.length < 2 || !ref) return null

    // 基準: 選んだ人のゴールタイムを距離で割った平均ペースで、ゴールまで均等に走った場合の通過タイム
    // （記録はネット。グロスでは基準の人のロスを足したタイムを使う）
    const refFinishMs = basis === "net" ? ref.timeMs : ref.timeMs + startLoss(ref.points)
    const refPaceMsPerKm = refFinishMs / distanceKm
    // 各人の、自分の通過地点での値（差なら秒、正 = 基準ペースより遅れ。順位なら何位か）と表示する文
    const values: Map<number, number>[] = []
    const texts: Map<number, string>[] = []
    if (mode === "gap") {
        for (const r of shown) {
            const v = new Map<number, number>()
            const t = new Map<number, string>()
            // スタート（0km）も含めて、全員の線をスタートから結ぶ（グロスはロスの分だけ遅れて始まる）
            for (const p of basisPoints(r.points, basis)) {
                const gap = (p.ms - refPaceMsPerKm * p.km) / 1000
                v.set(p.km, gap)
                t.set(p.km, gapText(gap))
            }
            values.push(v)
            texts.push(t)
        }
    } else {
        // ネットのスタートは全員 0 で順位がつかないため除く（グロスはスタートライン通過の順）
        const elapsed = shown.map(r => withFinish(
            basisPoints(r.points, basis).filter(p => basis === "gross" || p.km > 0), r, basis, distanceKm))
        for (const pts of elapsed) {
            const v = new Map<number, number>()
            const t = new Map<number, string>()
            for (const p of pts) {
                // その地点のタイムがある人の中での順位（同タイムは同順位）
                const faster = elapsed.filter(o => o.some(q => q.km === p.km && q.ms < p.ms)).length
                v.set(p.km, faster + 1)
                t.set(p.km, formatElapsed(p.ms))
            }
            values.push(v)
            texts.push(t)
        }
    }
    const xs = [...new Set(values.flatMap(g => [...g.keys()]))].sort((a, b) => a - b)
    // スタートの点しかない（通過地点が未入力）ならグラフを出さない
    if (xs.length <= 1) return null

    return (
        <div className="mt-2">
            <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm mb-1">
                <Toggle
                    label="グラフの種類"
                    value={mode}
                    options={[["gap", "基準ペースとの差"], ["rank", "順位の変動"]]}
                    onChange={m => { setMode(m); setTappedIndex(null) }}
                />
                {mode === "gap" && (
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
                )}
                <Toggle
                    label="比較するタイム"
                    value={basis}
                    options={[["net", "ネット"], ["gross", "グロス"]]}
                    onChange={setBasis}
                />
                <span className="text-gray-500">
                    {mode === "gap"
                        ? <>
                            上が先行・下が遅れ。0 は基準ペースで均等に走った場合
                            {basis === "net" ? "（スタートライン通過から）" : "（号砲から。スタートはロスの分だけ遅れて始まる）"}
                        </>
                        : <>
                            ラップを登録した人の中での、各地点の通過順位
                            {basis === "net" ? "（スタートライン通過からのタイム順）" : "（号砲からのタイム順。スタートはライン通過の順）"}
                            。その地点のタイムがない人は除いて数える
                        </>}
                    {coarsePointer && "。タップでその地点の順位を表示（もう一度タップで閉じる）"}
                </span>
            </div>
            <LineStyleContext.Provider value={styles}>
            {/* 横スクロールにするとグラフのジェスチャー処理とぶつかるため、画面幅に収める。
                グラフ上の縦スワイプはライブラリ側でページのスクロールになる */}
            <div className="relative">
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
                        yAxis={[mode === "gap"
                            ? {
                                reverse: true,
                                valueFormatter: (sec: number) => sec === 0 ? "0" : `${sec > 0 ? "+" : "-"}${formatGap(sec)}`,
                            }
                            : {
                                // 1位を上に、目盛りは整数の順位のみ
                                reverse: true,
                                min: 1,
                                max: shown.length,
                                tickMinStep: 1,
                                valueFormatter: (rank: number) => `${rank}位`,
                            }]}
                        series={shown.map((r, i) => ({
                            id: String(r.id),
                            label: r.name,
                            color: styles.get(String(r.id))!.color,
                            data: xs.map(x => values[i].get(x) ?? null),
                            connectNulls: true,
                            showMark: true,
                            valueFormatter: (v: number | null, { dataIndex }: { dataIndex: number }) =>
                                v === null ? "" : texts[i].get(xs[dataIndex]) ?? "",
                        }))}
                        slots={{ tooltip: RankTooltip }}
                        slotProps={{
                            // PC はポインタの少し上にツールチップ。スマホは指を離すと消えてしまうため使わず、下の固定表示にする
                            tooltip: coarsePointer
                                ? { trigger: "none" }
                                : {
                                    trigger: "axis",
                                    anchor: "pointer",
                                    position: "top",
                                    modifiers: [{ name: "offset", options: { offset: [0, 16] } }],
                                },
                        }}
                        // スマホ: タップで順位を表示し続け、もう一度タップで閉じる
                        onAxisClick={coarsePointer
                            ? (_e, d) => setTappedIndex(prev => prev !== null || !d ? null : d.dataIndex)
                            : undefined}
                        grid={{ horizontal: true }}
                    />
                {coarsePointer && tappedIndex !== null && tappedIndex < xs.length && (
                    // グラフの左上に重ねる。タップはグラフに通して、どこをタップしても閉じられるようにする
                    <div className="absolute top-0 left-12 pointer-events-none max-w-[calc(100%-3.5rem)]">
                        <RankList
                            km={xs[tappedIndex]}
                            items={shown.flatMap((r, i) => {
                                const v = values[i].get(xs[tappedIndex])
                                return v === undefined ? [] : [{ id: String(r.id), name: r.name, value: v, text: texts[i].get(xs[tappedIndex]) ?? "" }]
                            })}
                        />
                    </div>
                )}
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
