"use client"

import { useEffect, useRef, useState } from "react"
import "leaflet/dist/leaflet.css"
import type { RoutePoint } from "@/lib/gpx"

// 国土地理院の地図（地理院タイル）。出典の表示が利用条件
const GSI_ATTRIBUTION = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">地理院タイル</a>'
const GSI_LAYERS = [
    { name: "淡色地図", url: "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", maxNativeZoom: 18 },
    { name: "標準地図", url: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png", maxNativeZoom: 18 },
    { name: "写真", url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg", maxNativeZoom: 18 },
]

// 線の点（スタートからの km を持つ）から、interval km ごとに最初に超えた点を選ぶ
const kmMarkers = (line: RoutePoint[], interval: number) => {
    const marks: { km: number; at: [number, number] }[] = []
    let next = interval
    for (const [lat, lon, , km] of line) {
        if (km >= next) {
            marks.push({ km: next, at: [lat, lon] })
            next += interval
        }
    }
    // ゴールに重なる印は出さない
    const lastKm = line[line.length - 1][3]
    return marks.filter(m => lastKm - m.km > interval / 10)
}

// ルートを地理院地図の上に線で表示する。スタートは緑、ゴールは赤の丸。kmMarkerInterval があれば km の印を付ける。
// 全画面は画面いっぱいに重ねる形（iPhone の Safari は要素の全画面表示に対応していないため）
export function RouteMap({ line, className, kmMarkerInterval }: { line: RoutePoint[]; className?: string; kmMarkerInterval?: number }) {
    const container = useRef<HTMLDivElement>(null)
    const mapRef = useRef<import("leaflet").Map | null>(null)
    const boundsRef = useRef<import("leaflet").LatLngBounds | null>(null)
    const [fullscreen, setFullscreen] = useState(false)

    useEffect(() => {
        if (!container.current || line.length < 2) return
        let cancelled = false
        // Leaflet はブラウザの window を使うため、画面側で読み込む
        import("leaflet").then(L => {
            if (cancelled || !container.current) return
            const map = L.map(container.current, { scrollWheelZoom: false })
            mapRef.current = map
            const layers = GSI_LAYERS.map(l => L.tileLayer(l.url, { attribution: GSI_ATTRIBUTION, maxNativeZoom: l.maxNativeZoom, maxZoom: 19 }))
            layers[0].addTo(map)
            L.control.layers(Object.fromEntries(GSI_LAYERS.map((l, i) => [l.name, layers[i]]))).addTo(map)
            const latlngs = line.map(([lat, lon]) => [lat, lon] as [number, number])
            const route = L.polyline(latlngs, { color: "#2563eb", weight: 4, opacity: 0.85 }).addTo(map)
            L.circleMarker(latlngs[0], { radius: 7, color: "#fff", weight: 2, fillColor: "#16a34a", fillOpacity: 1 }).bindTooltip("スタート").addTo(map)
            L.circleMarker(latlngs[latlngs.length - 1], { radius: 7, color: "#fff", weight: 2, fillColor: "#dc2626", fillOpacity: 1 }).bindTooltip("ゴール").addTo(map)
            if (kmMarkerInterval) {
                for (const m of kmMarkers(line, kmMarkerInterval)) {
                    L.marker(m.at, {
                        icon: L.divIcon({ className: "route-km-marker", html: String(m.km), iconSize: [22, 16], iconAnchor: [11, 8] }),
                        keyboard: false,
                    }).bindTooltip(`${m.km}km 付近（GPS の距離の目安）`).addTo(map)
                }
            }
            boundsRef.current = route.getBounds()
            map.fitBounds(boundsRef.current, { padding: [20, 20] })
        })
        return () => {
            cancelled = true
            mapRef.current?.remove()
            mapRef.current = null
        }
    }, [line, kmMarkerInterval])

    // 全画面の切り替え: 地図の大きさを測り直してルート全体を表示し、全画面中はホイールで拡大縮小できるようにする
    useEffect(() => {
        const map = mapRef.current
        if (map) {
            map.invalidateSize()
            if (boundsRef.current) map.fitBounds(boundsRef.current, { padding: [20, 20] })
            if (fullscreen) map.scrollWheelZoom.enable()
            else map.scrollWheelZoom.disable()
        }
        if (!fullscreen) return
        // 後ろのページがスクロールしないようにし、Esc で閉じる
        const prevOverflow = document.body.style.overflow
        document.body.style.overflow = "hidden"
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false) }
        window.addEventListener("keydown", onKey)
        return () => {
            document.body.style.overflow = prevOverflow
            window.removeEventListener("keydown", onKey)
        }
    }, [fullscreen])

    return (
        <div
            className={fullscreen ? "fixed inset-0 z-[2000] bg-white" : `relative ${className ?? "h-80 w-full rounded border"}`}
            role={fullscreen ? "dialog" : undefined}
            aria-modal={fullscreen || undefined}
            aria-label={fullscreen ? "ルートの地図（全画面）" : undefined}
        >
            <div ref={container} className="h-full w-full" role="img" aria-label="ルートの地図" />
            <button
                type="button"
                onClick={() => setFullscreen(f => !f)}
                className="absolute z-[1000] left-[10px] bottom-[10px] px-2 py-1 text-xs bg-white border-2 border-black/20 rounded shadow-sm hover:bg-gray-100"
                style={fullscreen ? { bottom: "calc(10px + env(safe-area-inset-bottom, 0px))" } : undefined}
            >
                {fullscreen ? "全画面を閉じる" : "全画面で見る"}
            </button>
        </div>
    )
}
