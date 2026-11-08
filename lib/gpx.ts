// GPX の読み込み・距離と累積標高の計算・スタートとゴール付近の削除・地図用の間引き。
// すべてブラウザ側で行い、保存するのは削除・間引き後のものだけ

export type GpxPoint = { lat: number; lon: number; ele: number | null }

// 地図・高低差グラフ用の点 [緯度, 経度, 標高(m) または null, スタートからの距離(km)]
export type RoutePoint = [number, number, number | null, number]

export type ProcessedRoute = {
    // 元の GPX 全体の距離・累積標高（スタート・ゴール付近を消す前。走った距離そのもの）
    distanceKm: number
    elevationGainM: number | null
    // 保存する GPX（付近を消し、時刻・心拍などの付加情報を除いたもの）
    gpxText: string
    // 地図用に間引いた線（付近を消したもの）
    line: RoutePoint[]
}

// 地図用の線の最大点数（詳細ページを軽くするため）
const MAX_LINE_POINTS = 600
const EARTH_RADIUS_M = 6371008.8

// 2点間の距離（m）。地球を球とみなす（ハバーサインの公式）
export function distanceM(a: GpxPoint, b: GpxPoint) {
    const rad = Math.PI / 180
    const dLat = (b.lat - a.lat) * rad
    const dLon = (b.lon - a.lon) * rad
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
    return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

// GPX の文字列 → 点の並び。トラック（trkpt）がなければルート（rtept）を使う
export function parseGpx(text: string): GpxPoint[] {
    const doc = new DOMParser().parseFromString(text, "application/xml")
    if (doc.getElementsByTagName("parsererror").length > 0) throw new Error("GPX ファイルとして読み込めませんでした")
    let nodes = Array.from(doc.getElementsByTagNameNS("*", "trkpt"))
    if (nodes.length === 0) nodes = Array.from(doc.getElementsByTagNameNS("*", "rtept"))
    const points = nodes.flatMap(n => {
        const lat = Number(n.getAttribute("lat"))
        const lon = Number(n.getAttribute("lon"))
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return []
        const eleText = n.getElementsByTagNameNS("*", "ele")[0]?.textContent
        const ele = eleText != null && eleText.trim() !== "" && Number.isFinite(Number(eleText)) ? Number(eleText) : null
        return [{ lat, lon, ele }]
    })
    if (points.length < 2) throw new Error("GPX にルートの点が見つかりませんでした")
    return points
}

// 累積標高（上りの合計）。GPS の細かい揺れで増えすぎないよう、
// 前後 SMOOTH_HALF_M（道のり）の範囲で標高を平均したうえで、
// 直近の低い所から CLIMB_THRESHOLD_M 以上上がった分だけを数える。
// 平均を「点の数」ではなく「道のり」で取るのは、機器によって点の間隔（1秒ごと・数秒ごと）が違うため
const SMOOTH_HALF_M = 25
const CLIMB_THRESHOLD_M = 3
function elevationGain(points: GpxPoint[], cum: number[]): number | null {
    const idx = points.flatMap((p, i) => p.ele != null ? [i] : [])
    if (idx.length < 2) return null
    // 尺取り法で、各点の前後 SMOOTH_HALF_M に入る点の標高の合計を保つ
    const smoothed: number[] = []
    let lo = 0, hi = 0, sum = 0
    for (const i of idx) {
        while (hi < idx.length && cum[idx[hi]] <= cum[i] + SMOOTH_HALF_M) sum += points[idx[hi++]].ele!
        while (cum[idx[lo]] < cum[i] - SMOOTH_HALF_M) sum -= points[idx[lo++]].ele!
        smoothed.push(sum / (hi - lo))
    }
    let gain = 0
    let base = smoothed[0]
    for (const e of smoothed) {
        if (e - base >= CLIMB_THRESHOLD_M) { gain += e - base; base = e }
        else if (e < base) base = e
    }
    return Math.round(gain)
}

const round = (n: number, digits: number) => Number(n.toFixed(digits))

// 保存用の GPX（位置と標高だけ。時刻・心拍・機器名などは入れない）
function toGpx(points: GpxPoint[]) {
    const pts = points.map(p =>
        `      <trkpt lat="${round(p.lat, 6)}" lon="${round(p.lon, 6)}">${p.ele != null ? `<ele>${round(p.ele, 1)}</ele>` : ""}</trkpt>`,
    ).join("\n")
    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Runner's Record" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`
}

// trimM: スタート地点・ゴール地点から何 m 以内の点を消すか（自宅などの位置を出さないため）
export function processRoute(points: GpxPoint[], trimM: number): ProcessedRoute {
    // スタートからの距離（元の GPX 全体で数える）
    const cum = [0]
    for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + distanceM(points[i - 1], points[i]))

    // スタート地点から trimM 以上離れた最初の点から、ゴール地点から trimM 以上離れた最後の点まで残す
    const first = points[0]
    const last = points[points.length - 1]
    let from = 0
    let to = points.length - 1
    if (trimM > 0) {
        from = points.findIndex(p => distanceM(first, p) >= trimM)
        to = points.findLastIndex(p => distanceM(last, p) >= trimM)
    }
    if (from < 0 || to < 0 || to - from < 1) throw new Error("スタート・ゴール付近を消すと、ルートが残りません。消す範囲を狭くしてください")
    const kept = points.slice(from, to + 1)

    // 地図用に間引く（ほぼ等間隔に最大 MAX_LINE_POINTS 点。最初と最後の点は必ず残す）
    const step = (cum[to] - cum[from]) / MAX_LINE_POINTS
    const line: RoutePoint[] = []
    let lastKept = -Infinity
    for (let i = from; i <= to; i++) {
        if (i === from || i === to || cum[i] - lastKept >= step) {
            const p = points[i]
            line.push([round(p.lat, 5), round(p.lon, 5), p.ele != null ? round(p.ele, 1) : null, round(cum[i] / 1000, 3)])
            lastKept = cum[i]
        }
    }

    return {
        distanceKm: round(cum[cum.length - 1] / 1000, 2),
        elevationGainM: elevationGain(points, cum),
        gpxText: toGpx(kept),
        line,
    }
}
