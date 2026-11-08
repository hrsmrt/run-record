"use client"

import { useEffect, useRef } from "react"
import "leaflet/dist/leaflet.css"
import type { RoutePoint } from "@/lib/gpx"

// 国土地理院の地図（地理院タイル）。出典の表示が利用条件
const GSI_ATTRIBUTION = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">地理院タイル</a>'
const GSI_LAYERS = [
    { name: "淡色地図", url: "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", maxNativeZoom: 18 },
    { name: "標準地図", url: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png", maxNativeZoom: 18 },
    { name: "写真", url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg", maxNativeZoom: 18 },
]

// ルートを地理院地図の上に線で表示する。スタートは緑、ゴールは赤の丸
export function RouteMap({ line, className }: { line: RoutePoint[]; className?: string }) {
    const container = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!container.current || line.length < 2) return
        let cancelled = false
        let map: import("leaflet").Map | null = null
        // Leaflet はブラウザの window を使うため、画面側で読み込む
        import("leaflet").then(L => {
            if (cancelled || !container.current) return
            map = L.map(container.current, { scrollWheelZoom: false })
            const layers = GSI_LAYERS.map(l => L.tileLayer(l.url, { attribution: GSI_ATTRIBUTION, maxNativeZoom: l.maxNativeZoom, maxZoom: 19 }))
            layers[0].addTo(map)
            L.control.layers(Object.fromEntries(GSI_LAYERS.map((l, i) => [l.name, layers[i]]))).addTo(map)
            const latlngs = line.map(([lat, lon]) => [lat, lon] as [number, number])
            const route = L.polyline(latlngs, { color: "#2563eb", weight: 4, opacity: 0.85 }).addTo(map)
            L.circleMarker(latlngs[0], { radius: 7, color: "#fff", weight: 2, fillColor: "#16a34a", fillOpacity: 1 }).bindTooltip("スタート").addTo(map)
            L.circleMarker(latlngs[latlngs.length - 1], { radius: 7, color: "#fff", weight: 2, fillColor: "#dc2626", fillOpacity: 1 }).bindTooltip("ゴール").addTo(map)
            map.fitBounds(route.getBounds(), { padding: [20, 20] })
        })
        return () => {
            cancelled = true
            map?.remove()
        }
    }, [line])

    return <div ref={container} className={className ?? "h-80 w-full rounded border"} role="img" aria-label="ルートの地図" />
}
