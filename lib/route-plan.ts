// ルート案（地図で描いた点をつないだ線）の計算
import { type GpxPoint, type RoutePoint, distanceM } from "@/lib/gpx"
import { elevationAt } from "@/lib/elevation"

export type LatLon = [number, number]

// 点の間を DENSIFY_M ごとに細かくする（標高を道なりに取るため。10m メッシュなので細かすぎても意味がない）
const DENSIFY_M = 25

const toPoint = ([lat, lon]: LatLon): GpxPoint => ({ lat, lon, ele: null })

// 描いた点を順につないだ距離（km）。描いている間にすぐ出すため、標高は使わない
export function waypointsDistanceKm(waypoints: LatLon[]) {
    let m = 0
    for (let i = 1; i < waypoints.length; i++) m += distanceM(toPoint(waypoints[i - 1]), toPoint(waypoints[i]))
    return m / 1000
}

// 点の間を細かくし、各点の標高を国土地理院の標高タイルから取る
export async function densifyWithElevation(waypoints: LatLon[]): Promise<GpxPoint[]> {
    const points: GpxPoint[] = []
    for (let i = 0; i < waypoints.length; i++) {
        const a = toPoint(waypoints[i])
        if (i === 0) { points.push(a); continue }
        const prev = toPoint(waypoints[i - 1])
        const steps = Math.max(1, Math.ceil(distanceM(prev, a) / DENSIFY_M))
        for (let s = 1; s <= steps; s++) {
            const t = s / steps
            points.push({ lat: prev.lat + (a.lat - prev.lat) * t, lon: prev.lon + (a.lon - prev.lon) * t, ele: null })
        }
    }
    const eles = await Promise.all(points.map(p => elevationAt(p.lat, p.lon)))
    return points.map((p, i) => ({ ...p, ele: eles[i] }))
}

// 既存のルート（数百点）を、手で動かせる程度の点に減らす（ダグラス・ポーカー法、許容 toleranceM）
export function simplifyLine(line: RoutePoint[], toleranceM = 15): LatLon[] {
    const pts = line.map(([lat, lon]) => [lat, lon] as LatLon)
    if (pts.length <= 2) return pts
    // 小さな範囲なので、緯度経度を m の平面に近似して点と線分の距離を測る
    const lat0 = pts[0][0] * Math.PI / 180
    const xy = pts.map(([lat, lon]) => [lon * 111320 * Math.cos(lat0), lat * 110540])
    const keep = new Array(pts.length).fill(false)
    keep[0] = keep[pts.length - 1] = true
    const stack: [number, number][] = [[0, pts.length - 1]]
    while (stack.length > 0) {
        const [s, e] = stack.pop()!
        const [ax, ay] = xy[s], [bx, by] = xy[e]
        const len2 = (bx - ax) ** 2 + (by - ay) ** 2
        let maxD = -1, idx = -1
        for (let i = s + 1; i < e; i++) {
            const [px, py] = xy[i]
            const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / len2))
            const d = Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay)))
            if (d > maxD) { maxD = d; idx = i }
        }
        if (maxD > toleranceM && idx > 0) {
            keep[idx] = true
            stack.push([s, idx], [idx, e])
        }
    }
    return pts.filter((_, i) => keep[i])
}
