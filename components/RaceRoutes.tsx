"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RoutePoint } from "@/lib/gpx"
import { formatKm } from "@/lib/practices"
import { RouteMap } from "@/components/RouteMap"
import { ElevationChart } from "@/components/ElevationChart"
import { GpxPicker, type GpxSelection } from "@/components/GpxPicker"

const ROUTE_BUCKET = "race-routes"
// 地図に付ける km の印の間隔
const KM_MARKER_INTERVAL = 5

// public_race_routes の行（route_line は地図を開いたときに取る）
export type RaceRouteInfo = {
    race_id: number
    route_path: string
    distance_km: number | null
    elevation_gain_m: number | null
    uploaded_by_name: string | null
    updated_at: string
    can_edit: boolean
}

// 一覧で取る列（route_line は数百点あるので除く）
export const RACE_ROUTE_COLUMNS = "race_id, route_path, distance_km, elevation_gain_m, uploaded_by_name, updated_at, can_edit"

type RaceInfo = { id: number; name: string; distance_km: number }

const formatLocalDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
}

// 開催回の種目ごとのコース（メンバーが計測した GPX）。
// 登録・差し替え・削除は、その種目に自分の記録がある人と管理者（editable に入っている種目）
export function RaceRoutes({ races, routes, editable, onChanged }: {
    races: RaceInfo[]
    routes: Map<number, RaceRouteInfo>
    editable: Set<number>
    onChanged: () => void
}) {
    const shown = races.filter(r => routes.has(r.id) || editable.has(r.id))
    if (shown.length === 0) return null
    return (
        <div className="mt-2 flex flex-col gap-1">
            <h4 className="text-xs font-bold text-gray-600">コース</h4>
            {shown.map(r => (
                <RaceRouteRow key={r.id} race={r} route={routes.get(r.id) ?? null} editable={editable.has(r.id)} onChanged={onChanged} />
            ))}
        </div>
    )
}

function RaceRouteRow({ race, route, editable, onChanged }: {
    race: RaceInfo
    route: RaceRouteInfo | null
    editable: boolean
    onChanged: () => void
}) {
    const [line, setLine] = useState<RoutePoint[] | null>(null)
    const [open, setOpen] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [gpx, setGpx] = useState<GpxSelection>({ hasFile: false, route: null, error: "" })
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

    const toggleMap = async () => {
        if (open) { setOpen(false); return }
        setOpen(true)
        if (line) return
        const { data, error } = await createClient().from("public_race_routes").select("route_line").eq("race_id", race.id).maybeSingle()
        if (error || !data) { setMessage({ text: `地図を読み込めませんでした: ${error?.message ?? ""}`, isError: true }); return }
        setLine(data.route_line as RoutePoint[])
    }

    // 一時的な署名付き URL でダウンロードする（ファイル置き場は非公開のため）
    const handleDownload = async () => {
        if (!route) return
        const { data, error } = await createClient().storage.from(ROUTE_BUCKET)
            .createSignedUrl(route.route_path, 60, { download: `course-${race.id}.gpx` })
        if (error || !data) { setMessage({ text: `ダウンロードできませんでした: ${error?.message ?? ""}`, isError: true }); return }
        window.location.assign(data.signedUrl)
    }

    const handleSave = async () => {
        if (!gpx.route) { setMessage({ text: gpx.error || "GPX ファイルを選んでください", isError: true }); return }
        setSaving(true)
        setMessage(null)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setSaving(false); setMessage({ text: "ログインしてください", isError: true }); return }
        const path = `${race.id}/route.gpx`
        const { error: upError } = await supabase.storage.from(ROUTE_BUCKET).upload(
            path, new Blob([gpx.route.gpxText], { type: "application/gpx+xml" }),
            { upsert: true, contentType: "application/gpx+xml" },
        )
        if (upError) { setSaving(false); setMessage({ text: `保存に失敗しました: ${upError.message}`, isError: true }); return }
        // 登録した人は本人（差し替えたら差し替えた人になる）
        const { error } = await supabase.from("race_routes").upsert({
            race_id: race.id,
            route_path: path,
            route_line: gpx.route.line,
            distance_km: gpx.route.distanceKm,
            elevation_gain_m: gpx.route.elevationGainM,
            uploaded_by: user.id,
            updated_at: new Date().toISOString(),
        }, { onConflict: "race_id" })
        setSaving(false)
        if (error) { setMessage({ text: `保存に失敗しました: ${error.message}`, isError: true }); return }
        setLine(gpx.route.line)
        setUploading(false)
        setOpen(true)
        setMessage({ text: "コースを保存しました", isError: false })
        onChanged()
    }

    const handleDelete = async () => {
        if (!route || !confirm(`${race.name}のコースを削除しますか？`)) return
        const supabase = createClient()
        const { error: rmError } = await supabase.storage.from(ROUTE_BUCKET).remove([route.route_path])
        if (rmError) { setMessage({ text: `削除に失敗しました: ${rmError.message}`, isError: true }); return }
        const { error } = await supabase.from("race_routes").delete().eq("race_id", race.id)
        if (error) { setMessage({ text: `削除に失敗しました: ${error.message}`, isError: true }); return }
        setLine(null)
        setOpen(false)
        setMessage(null)
        onChanged()
    }

    return (
        <div className="bg-white text-black p-2 border rounded text-sm">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-bold">{race.name}</span>
                {route ? (
                    <>
                        <span className="text-xs text-gray-600">
                            {route.uploaded_by_name ?? "（退会したメンバー）"}さんの計測（{formatLocalDate(route.updated_at)} 登録）
                            {route.distance_km != null && `・GPS ${formatKm(route.distance_km)}`}
                            {route.elevation_gain_m != null && `・累積標高 ${route.elevation_gain_m.toLocaleString()}m`}
                        </span>
                        <button onClick={toggleMap} className="text-xs text-blue-600 hover:underline" aria-expanded={open}>
                            {open ? "地図を閉じる" : "地図を表示"}
                        </button>
                        <button onClick={handleDownload} className="text-xs text-blue-600 hover:underline">GPX をダウンロード</button>
                        {editable && !uploading && (
                            <>
                                <button onClick={() => setUploading(true)} className="text-xs text-blue-600 hover:underline">差し替え</button>
                                <button onClick={handleDelete} className="text-xs text-red-600 hover:underline">削除</button>
                            </>
                        )}
                    </>
                ) : (
                    <>
                        <span className="text-xs text-gray-500">まだ登録されていません</span>
                        {!uploading && (
                            <button onClick={() => setUploading(true)} className="text-xs text-blue-600 hover:underline">自分の計測データ（GPX）を登録</button>
                        )}
                    </>
                )}
            </div>
            {message && <p className={`mt-1 text-xs ${message.isError ? "text-red-600" : "text-green-700"}`}>{message.text}</p>}
            {uploading && (
                <div className="mt-2 flex flex-col gap-2 border-t pt-2">
                    <GpxPicker defaultTrimM={0} onChange={setGpx} kmMarkerInterval={KM_MARKER_INTERVAL} />
                    <div className="flex items-center gap-3">
                        <button onClick={handleSave} disabled={saving || !gpx.route} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-xs">
                            {saving ? "保存中..." : route ? "差し替える" : "登録する"}
                        </button>
                        <button onClick={() => { setUploading(false); setGpx({ hasFile: false, route: null, error: "" }) }} className="text-xs text-gray-600 hover:underline">やめる</button>
                    </div>
                    <p className="text-xs text-gray-500">
                        登録した人の名前が表示されます。登録・差し替え・削除は、この種目に記録がある人と管理者ができます。
                    </p>
                </div>
            )}
            {open && line && (
                <div className="mt-2 flex flex-col gap-2">
                    <RouteMap line={line} kmMarkerInterval={KM_MARKER_INTERVAL} />
                    <ElevationChart line={line} />
                    <p className="text-xs text-gray-500">※ km の印と距離は GPS の計測による目安で、大会の距離表示とは少しずれます。</p>
                </div>
            )}
        </div>
    )
}
