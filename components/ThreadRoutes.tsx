"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type { RoutePoint } from "@/lib/gpx"
import { formatKm } from "@/lib/practices"
import { formatDateTime } from "@/components/MessageThread"
import { EnrollmentTag } from "@/components/EnrollmentTag"
import { LinkifiedText } from "@/components/CommentText"
import { RouteMap } from "@/components/RouteMap"
import { ElevationChart } from "@/components/ElevationChart"
import { GpxPicker, type GpxSelection } from "@/components/GpxPicker"
import { RoutePlanner, type PlanSelection } from "@/components/RoutePlanner"
import { THREAD_ROUTE_NAME_MAX, THREAD_ROUTE_NOTE_MAX, type ThreadRoute } from "@/lib/board"

// ルート案の線の色（練習録のルート案と同じ紫）と km の印の間隔
const PLAN_COLOR = "#7c3aed"
const KM_MARKER_INTERVAL = 1

// 話題のルート案の一覧と登録欄。登録はメンバーなら誰でも、削除は登録した本人・話題を立てた人・管理人。
// 話題を立てた人・管理人には、ルート案から練習予定を作るリンクを出す
export function ThreadRoutes({ threadId, threadTitle, routes, canAdd, canEditThread, onChanged }: {
    threadId: number
    threadTitle: string
    routes: ThreadRoute[]
    canAdd: boolean
    canEditThread: boolean
    onChanged: () => void
}) {
    const [adding, setAdding] = useState(false)
    return (
        <div className="flex flex-col gap-2 text-sm">
            {routes.length === 0 && !adding && <p className="text-gray-600">まだルート案はありません。</p>}
            {routes.map(r => (
                <ThreadRouteRow key={r.id} route={r} threadId={threadId} threadTitle={threadTitle} canEditThread={canEditThread} onChanged={onChanged} />
            ))}
            {canAdd && (adding ? (
                <ThreadRouteForm threadId={threadId} onDone={saved => { setAdding(false); if (saved) onChanged() }} />
            ) : (
                <button onClick={() => setAdding(true)} className="self-start px-3 py-1 border rounded bg-white hover:bg-gray-100 text-xs">ルート案を追加</button>
            ))}
        </div>
    )
}

function ThreadRouteRow({ route, threadId, threadTitle, canEditThread, onChanged }: {
    route: ThreadRoute
    threadId: number
    threadTitle: string
    canEditThread: boolean
    onChanged: () => void
}) {
    const [line, setLine] = useState<RoutePoint[] | null>(null)
    const [open, setOpen] = useState(false)
    const [error, setError] = useState("")

    const toggleMap = async () => {
        if (open) { setOpen(false); return }
        setOpen(true)
        if (line) return
        const { data, error } = await createClient().from("public_thread_routes").select("route_line").eq("id", route.id).maybeSingle()
        if (error || !data) { setError(`地図を読み込めませんでした: ${error?.message ?? ""}`); return }
        setLine(data.route_line as RoutePoint[])
    }

    const handleDelete = async () => {
        if (!confirm(`ルート案「${route.name}」を削除しますか？`)) return
        const { error } = await createClient().from("thread_routes").delete().eq("id", route.id)
        if (error) { setError(`削除に失敗しました: ${error.message}`); return }
        onChanged()
    }

    return (
        <div className="bg-white p-2 border rounded">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-bold">{route.name}</span>
                <span className="text-xs">
                    {route.distance_km != null && formatKm(route.distance_km)}
                    {route.elevation_gain_m != null && `・累積標高 ${route.elevation_gain_m.toLocaleString()}m`}
                </span>
                <span className={`text-xs text-gray-600 ${route.author_gender === "female" ? "text-red-600" : ""}`}>
                    {route.author_name ?? "（退会したメンバー）"}<EnrollmentTag year={route.author_enrollment_year} />・{formatDateTime(route.created_at)}
                </span>
                <button onClick={toggleMap} className="text-xs text-blue-600 hover:underline" aria-expanded={open}>
                    {open ? "地図を閉じる" : "地図を表示"}
                </button>
                {canEditThread && (
                    <Link
                        href={`/practices/new?title=${encodeURIComponent(threadTitle)}&thread=${threadId}&route=${route.id}`}
                        className="text-xs text-blue-600 hover:underline"
                    >
                        このルートで練習予定を作る
                    </Link>
                )}
                {route.can_delete && <button onClick={handleDelete} className="text-xs text-red-600 hover:underline">削除</button>}
            </div>
            {route.note && <div className="mt-1 text-xs"><LinkifiedText text={route.note} /></div>}
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
            {open && line && (
                <div className="mt-2 flex flex-col gap-2">
                    <RouteMap line={line} kmMarkerInterval={KM_MARKER_INTERVAL} color={PLAN_COLOR} />
                    <ElevationChart line={line} />
                </div>
            )}
        </div>
    )
}

// 地図で描くか GPX を取り込んで、ルート案を1件登録する
function ThreadRouteForm({ threadId, onDone }: { threadId: number; onDone: (saved: boolean) => void }) {
    const [mode, setMode] = useState<"draw" | "gpx">("draw")
    const [name, setName] = useState("")
    const [note, setNote] = useState("")
    const [plan, setPlan] = useState<PlanSelection>({ changed: false, route: null, computing: false })
    const [gpx, setGpx] = useState<GpxSelection>({ hasFile: false, route: null, error: "" })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")

    const handleSave = async () => {
        if (name.trim() === "") { setError("名前を入力してください（例: A案 皇居2周）"); return }
        if (mode === "draw" && plan.computing) { setError("標高を計算中です。少し待ってから保存してください"); return }
        const route = mode === "draw" ? plan.route : gpx.route
        if (!route) { setError(mode === "draw" ? "地図をクリックしてルートを描いてください" : gpx.error || "GPX ファイルを選んでください"); return }
        setSaving(true)
        setError("")
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setSaving(false); setError("ログインしてください"); return }
        const { error } = await supabase.from("thread_routes").insert({
            thread_id: threadId,
            name: name.trim(),
            note: note.trim() || null,
            route_line: route.line,
            distance_km: route.distanceKm,
            elevation_gain_m: route.elevationGainM,
            created_by: user.id,
        })
        setSaving(false)
        if (error) { setError(`保存に失敗しました: ${error.message}`); return }
        onDone(true)
    }

    const inputClass = "border rounded px-2 py-1 bg-white"
    return (
        <div className="flex flex-col gap-2 border rounded p-2 bg-gray-50">
            <label className="flex flex-col gap-1">
                <span className="font-semibold">名前</span>
                <input value={name} maxLength={THREAD_ROUTE_NAME_MAX} onChange={e => setName(e.target.value)} placeholder="例: A案 皇居2周" className={`${inputClass} max-w-sm`} />
            </label>
            <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-1">
                    <input type="radio" checked={mode === "draw"} onChange={() => setMode("draw")} />
                    地図で描く
                </label>
                <label className="flex items-center gap-1">
                    <input type="radio" checked={mode === "gpx"} onChange={() => setMode("gpx")} />
                    GPX を取り込む
                </label>
            </div>
            {mode === "draw" ? (
                <RoutePlanner initialLine={null} onChange={setPlan} />
            ) : (
                <GpxPicker defaultTrimM={300} onChange={setGpx} kmMarkerInterval={KM_MARKER_INTERVAL} />
            )}
            <label className="flex flex-col gap-1">
                <span className="font-semibold">ひとこと <span className="text-xs font-normal text-gray-500">（任意。坂が多い・給水できる所など）</span></span>
                <textarea value={note} maxLength={THREAD_ROUTE_NOTE_MAX} onChange={e => setNote(e.target.value)} rows={2} className="w-full border rounded p-2 bg-white" />
            </label>
            <div className="flex items-center gap-3">
                <button onClick={handleSave} disabled={saving} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-xs">
                    {saving ? "保存中..." : "ルート案を保存"}
                </button>
                <button onClick={() => onDone(false)} className="text-xs text-gray-600 hover:underline">やめる</button>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <p className="text-xs text-gray-500">
                登録した人の名前が表示されます。GPX を取り込んだときも、保存するのは地図用の線と距離・累積標高だけです（ファイルは保存しません）。
            </p>
        </div>
    )
}
