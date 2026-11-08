"use client"

import { useEffect, useRef, useState } from "react"
import "leaflet/dist/leaflet.css"
import { createClient } from "@/lib/supabase/client"
import { type ProcessedRoute, type RoutePoint, processRoute } from "@/lib/gpx"
import { type LatLon, densifyWithElevation, simplifyLine, waypointsDistanceKm } from "@/lib/route-plan"
import { formatDate } from "@/components/RaceGroups"
import { ElevationChart } from "@/components/ElevationChart"
import { practiceTitle } from "@/lib/practices"

const GSI_ATTRIBUTION = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">地理院タイル</a>'
const GSI_LAYERS = [
    { name: "標準地図", url: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png" },
    { name: "淡色地図", url: "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png" },
    { name: "写真", url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg" },
]
// 何もないときに最初に表示する場所（皇居周辺）
const DEFAULT_CENTER: LatLon = [35.6852, 139.7528]
// 描き終わってから標高を取りに行くまでの待ち時間（点を続けて置いている間に何度も取りに行かないように）
const ELEVATION_DELAY_MS = 800

// ルート案の状態。route は点が2つ以上のときだけ（標高の計算が終わるまでは null で computing が true）
export type PlanSelection = { changed: boolean; route: ProcessedRoute | null; computing: boolean }

type PastRoute = { id: number; held_on: string; title: string | null; has_route: boolean; has_plan_route: boolean }

// 地図をクリックして点を置き、点を直線でつないでルート案を描く。点はドラッグで動かせる
export function RoutePlanner({ initialLine, onChange }: {
    initialLine: RoutePoint[] | null
    onChange: (selection: PlanSelection) => void
}) {
    const container = useRef<HTMLDivElement>(null)
    const mapRef = useRef<import("leaflet").Map | null>(null)
    const layerRef = useRef<import("leaflet").LayerGroup | null>(null)
    const leafletRef = useRef<typeof import("leaflet") | null>(null)
    // 既存のルート案は、手で動かせる程度の点に減らしてから始める
    const [waypoints, setWaypoints] = useState<LatLon[]>(() => initialLine ? simplifyLine(initialLine) : [])
    const [changed, setChanged] = useState(false)
    const [route, setRoute] = useState<ProcessedRoute | null>(null)
    const [computing, setComputing] = useState(false)
    const [mapReady, setMapReady] = useState(false)
    const [pastRoutes, setPastRoutes] = useState<PastRoute[] | null>(null)
    const [error, setError] = useState("")
    const [fullscreen, setFullscreen] = useState(false)
    const onChangeRef = useRef(onChange)
    useEffect(() => { onChangeRef.current = onChange }, [onChange])

    const edit = (next: (prev: LatLon[]) => LatLon[]) => { setWaypoints(next); setChanged(true) }

    // 地図を1回だけ作る
    useEffect(() => {
        if (!container.current) return
        let cancelled = false
        import("leaflet").then(L => {
            if (cancelled || !container.current) return
            leafletRef.current = L
            const map = L.map(container.current, { doubleClickZoom: false })
            mapRef.current = map
            const layers = GSI_LAYERS.map(l => L.tileLayer(l.url, { attribution: GSI_ATTRIBUTION, maxNativeZoom: 18, maxZoom: 19 }))
            layers[0].addTo(map)
            L.control.layers(Object.fromEntries(GSI_LAYERS.map((l, i) => [l.name, layers[i]]))).addTo(map)
            layerRef.current = L.layerGroup().addTo(map)
            map.on("click", e => edit(prev => [...prev, [Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))]]))
            map.setView(DEFAULT_CENTER, 14)
            setMapReady(true)
        })
        return () => {
            cancelled = true
            mapRef.current?.remove()
            mapRef.current = null
        }
    }, [])

    // 初めて地図ができたときだけ、描いてあるルート全体が見えるようにする
    const fittedRef = useRef(false)
    useEffect(() => {
        const L = leafletRef.current
        if (!mapReady || !L || !mapRef.current || fittedRef.current || waypoints.length < 2) return
        mapRef.current.fitBounds(L.latLngBounds(waypoints), { padding: [20, 20] })
        fittedRef.current = true
    }, [mapReady, waypoints])

    // 点と線を描き直す
    useEffect(() => {
        const L = leafletRef.current
        const layer = layerRef.current
        if (!mapReady || !L || !layer) return
        layer.clearLayers()
        if (waypoints.length >= 2) L.polyline(waypoints, { color: "#7c3aed", weight: 4, opacity: 0.85 }).addTo(layer)
        waypoints.forEach((p, i) => {
            const isStart = i === 0
            const isEnd = i === waypoints.length - 1 && i > 0
            const marker = L.marker(p, {
                draggable: true,
                icon: L.divIcon({
                    className: "",
                    html: `<div style="width:${isStart || isEnd ? 14 : 10}px;height:${isStart || isEnd ? 14 : 10}px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 2px #000;background:${isStart ? "#16a34a" : isEnd ? "#dc2626" : "#7c3aed"}"></div>`,
                    iconSize: isStart || isEnd ? [14, 14] : [10, 10],
                    iconAnchor: isStart || isEnd ? [7, 7] : [5, 5],
                }),
            })
            marker.on("dragend", () => {
                const ll = marker.getLatLng()
                edit(prev => prev.map((q, j) => j === i ? [Number(ll.lat.toFixed(6)), Number(ll.lng.toFixed(6))] as LatLon : q))
            })
            marker.bindTooltip(isStart ? "スタート" : isEnd ? "ゴール" : `${i + 1}`)
            marker.addTo(layer)
        })
    }, [mapReady, waypoints])

    // 描き終わって少し待ってから、点の間を細かくして標高を取り、距離・累積標高・GPX を作る
    useEffect(() => {
        if (waypoints.length < 2) {
            setRoute(null)
            setComputing(false)
            return
        }
        setComputing(true)
        let cancelled = false
        const timer = setTimeout(async () => {
            try {
                const points = await densifyWithElevation(waypoints)
                if (!cancelled) setRoute(processRoute(points, 0))
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : String(e))
            } finally {
                if (!cancelled) setComputing(false)
            }
        }, ELEVATION_DELAY_MS)
        return () => { cancelled = true; clearTimeout(timer) }
    }, [waypoints])

    useEffect(() => {
        onChangeRef.current({ changed, route: waypoints.length >= 2 ? route : null, computing })
    }, [changed, route, computing, waypoints.length])

    // 全画面の切り替え（画面いっぱいに重ねる形。iPhone の Safari は要素の全画面表示に対応していないため）。
    // 地図の大きさを測り直し、後ろのページのスクロールを止め、Esc で閉じる
    useEffect(() => {
        mapRef.current?.invalidateSize()
        if (!fullscreen) return
        const prevOverflow = document.body.style.overflow
        document.body.style.overflow = "hidden"
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false) }
        window.addEventListener("keydown", onKey)
        return () => {
            document.body.style.overflow = prevOverflow
            window.removeEventListener("keydown", onKey)
        }
    }, [fullscreen])

    const loadPastList = async () => {
        if (pastRoutes) { setPastRoutes(null); return }
        const { data, error } = await createClient().from("public_practices")
            .select("id, held_on, title, has_route, has_plan_route")
            .or("has_route.eq.true,has_plan_route.eq.true")
            .order("held_on", { ascending: false }).limit(100)
        if (error) { setError(`読み込めませんでした: ${error.message}`); return }
        setPastRoutes((data ?? []) as PastRoute[])
    }

    const startFromPast = async (p: PastRoute, kind: "route" | "plan") => {
        if (waypoints.length > 0 && !confirm("今描いているルート案を、選んだルートに置き換えますか？")) return
        const column = kind === "route" ? "route_line" : "plan_route_line"
        const { data, error } = await createClient().from("public_practices").select(column).eq("id", p.id).maybeSingle()
        const line = (data as Record<string, RoutePoint[] | null> | null)?.[column]
        if (error || !line) { setError(`読み込めませんでした: ${error?.message ?? ""}`); return }
        const next = simplifyLine(line)
        edit(() => next)
        setPastRoutes(null)
        const L = leafletRef.current
        if (L && mapRef.current && next.length >= 2) mapRef.current.fitBounds(L.latLngBounds(next), { padding: [20, 20] })
    }

    const button = "px-2 py-1 border rounded bg-white hover:bg-gray-100 text-xs disabled:opacity-50"
    const km = waypointsDistanceKm(waypoints)

    return (
        <div className="flex flex-col gap-2 text-sm">
            {/* 全画面のときは、ボタン・地図・距離の表示をまとめて画面いっぱいに出す */}
            <div
                className={fullscreen ? "fixed inset-0 z-[2000] bg-white flex flex-col gap-2 p-2" : "flex flex-col gap-2"}
                style={fullscreen ? { paddingTop: "calc(0.5rem + env(safe-area-inset-top, 0px))", paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))" } : undefined}
                role={fullscreen ? "dialog" : undefined}
                aria-modal={fullscreen || undefined}
                aria-label={fullscreen ? "ルート案を描く（全画面）" : undefined}
            >
                <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className={button} disabled={waypoints.length === 0} onClick={() => edit(prev => prev.slice(0, -1))}>1つ戻す</button>
                    <button type="button" className={button} disabled={waypoints.length < 2} onClick={() => edit(prev => [...prev, prev[0]])}>スタートに戻って周回にする</button>
                    <button type="button" className={button} disabled={waypoints.length < 2} onClick={() => edit(prev => [...prev, ...prev.slice(0, -1).reverse()])}>同じ道で折り返す（往復）</button>
                    <button type="button" className={button} disabled={waypoints.length === 0} onClick={() => confirm("描いたルート案をすべて消しますか？") && edit(() => [])}>すべて消す</button>
                    <button type="button" className={button} onClick={loadPastList}>{pastRoutes ? "閉じる" : "過去のルートから始める"}</button>
                    <button type="button" className={`${button} ml-auto font-bold`} onClick={() => setFullscreen(f => !f)}>
                        {fullscreen ? "全画面を閉じる" : "全画面で描く"}
                    </button>
                </div>
                {pastRoutes && (
                    <ul className="max-h-48 overflow-y-auto border rounded bg-white p-1 text-xs">
                        {pastRoutes.length === 0 && <li className="p-1 text-gray-500">ルートのある練習録はまだありません。</li>}
                        {pastRoutes.map(p => (
                            <li key={p.id} className="flex flex-wrap items-center gap-2 px-1 py-0.5">
                                <span className="font-mono">{formatDate(p.held_on)}</span>
                                <span>{practiceTitle(p)}</span>
                                {p.has_route && <button type="button" onClick={() => startFromPast(p, "route")} className="text-blue-600 hover:underline">走ったルート</button>}
                                {p.has_plan_route && <button type="button" onClick={() => startFromPast(p, "plan")} className="text-blue-600 hover:underline">ルート案</button>}
                            </li>
                        ))}
                    </ul>
                )}
                {/* 地図の入れ物の className は変えない（React が書き換えると、Leaflet が付けたクラスが消えて地図が出なくなる）。
                    高さの切り替えは外側の枠で行う */}
                <div className={`${fullscreen ? "flex-1 min-h-0" : "h-96"} w-full`}>
                    <div ref={container} className="h-full w-full rounded border" role="application" aria-label="ルート案を描く地図" />
                </div>
                <p>
                    {waypoints.length < 2 ? "地図をクリックして、スタートから順に点を置いてください。" : (
                        <>
                            距離 <strong>{km.toFixed(2)}km</strong>
                            {computing ? "（標高を計算中…）" : route?.elevationGainM != null && `・累積標高 ${route.elevationGainM}m`}
                        </>
                    )}
                </p>
            </div>
            {route && !computing && <div className="bg-white"><ElevationChart line={route.line} /></div>}
            {error && <p className="text-red-600">{error}</p>}
            <p className="text-xs text-gray-500">
                点と点は直線でつながります。曲がり角ごとに点を置くと道に沿います。点はドラッグで動かせます。
                標高は国土地理院の標高データ（10m メッシュ）から取っています。
            </p>
        </div>
    )
}
