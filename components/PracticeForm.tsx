"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useUnsavedWarning } from "@/lib/use-unsaved-warning"
import { MemberPicker } from "@/components/MemberPicker"
import { type DirectoryMember, formatKm, parseKm } from "@/lib/practices"
import { type GpxPoint, type ProcessedRoute, type RoutePoint, parseGpx, processRoute } from "@/lib/gpx"
import { RouteMap } from "@/components/RouteMap"

const ROUTE_BUCKET = "practice-routes"
// スタート・ゴール付近を消す範囲の選択肢（m）
const TRIM_OPTIONS = [0, 100, 200, 300, 500, 1000]
const MAX_GPX_BYTES = 10 * 1024 * 1024

const MEMO_MAX = 2000

const todayStr = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// 練習録の新規作成・編集。practiceId がなければ新規
export function PracticeForm({ practiceId }: { practiceId?: number }) {
    const router = useRouter()
    const [members, setMembers] = useState<DirectoryMember[]>([])
    const [status, setStatus] = useState<"loading" | "notFound" | "ok">("loading")
    const [heldOn, setHeldOn] = useState(todayStr)
    const [title, setTitle] = useState("")
    const [organizerId, setOrganizerId] = useState("")
    const [distanceStr, setDistanceStr] = useState("")
    const [memo, setMemo] = useState("")
    const [participants, setParticipants] = useState<Set<string>>(new Set())
    // 登録済みのルート
    const [savedRoute, setSavedRoute] = useState<{ path: string; line: RoutePoint[] } | null>(null)
    const [removeRoute, setRemoveRoute] = useState(false)
    // 新しく選んだ GPX（元の点はブラウザ内だけに持ち、消す範囲を変えたら作り直す）
    const [gpxPoints, setGpxPoints] = useState<GpxPoint[] | null>(null)
    const [gpxName, setGpxName] = useState("")
    const [gpxError, setGpxError] = useState("")
    const [trimM, setTrimM] = useState(300)
    const [dirty, setDirty] = useState(false)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

    useUnsavedWarning(dirty)

    useEffect(() => {
        const load = async () => {
            const supabase = createClient()
            const { data: dir, error } = await supabase.rpc("member_directory")
            if (error) { setMessage({ text: `メンバー一覧の読み込みに失敗しました: ${error.message}`, isError: true }); setStatus("ok"); return }
            const list = (dir ?? []) as DirectoryMember[]
            setMembers(list)

            if (practiceId == null) {
                // 新規は自分を主催者・参加メンバーにしておく
                const me = list.find(m => m.is_me)
                if (me) { setOrganizerId(me.user_id); setParticipants(new Set([me.user_id])) }
                setStatus("ok")
                return
            }
            const { data: pr } = await supabase
                .from("practices")
                .select("held_on, title, organizer_id, distance_km, memo, route_path, route_line")
                .eq("id", practiceId)
                .maybeSingle()
            const { data: canEdit } = await supabase.rpc("practice_can_edit", { p_practice_id: practiceId })
            if (!pr || !canEdit) { setStatus("notFound"); return }
            const { data: pps } = await supabase.from("practice_participants").select("user_id").eq("practice_id", practiceId)
            setHeldOn(pr.held_on)
            setTitle(pr.title ?? "")
            setOrganizerId(pr.organizer_id ?? "")
            setDistanceStr(pr.distance_km == null ? "" : String(Number(pr.distance_km)))
            setMemo(pr.memo ?? "")
            if (pr.route_path && pr.route_line) setSavedRoute({ path: pr.route_path, line: pr.route_line as RoutePoint[] })
            setParticipants(new Set((pps ?? []).map(p => p.user_id as string)))
            setStatus("ok")
        }
        load()
    }, [practiceId])

    // 選んだ GPX を、消す範囲に合わせて処理し直す
    const processed = useMemo<{ route: ProcessedRoute | null; error: string }>(() => {
        if (!gpxPoints) return { route: null, error: "" }
        try { return { route: processRoute(gpxPoints, trimM), error: "" } }
        catch (e) { return { route: null, error: e instanceof Error ? e.message : String(e) } }
    }, [gpxPoints, trimM])

    const handleFile = async (file: File | undefined) => {
        setGpxError("")
        setGpxPoints(null)
        setGpxName("")
        if (!file) return
        if (file.size > MAX_GPX_BYTES) { setGpxError("GPX ファイルは 10MB までです"); return }
        try {
            const points = parseGpx(await file.text())
            setGpxPoints(points)
            setGpxName(file.name)
            setDirty(true)
            // 距離が空欄なら GPX の距離を入れる
            const route = processRoute(points, 0)
            setDistanceStr(prev => prev.trim() === "" ? String(route.distanceKm) : prev)
        } catch (e) {
            setGpxError(e instanceof Error ? e.message : String(e))
        }
    }

    // 練習録を保存した後に、ルートを置き換える・消す。失敗したらメッセージを返す
    const saveRoute = async (id: number): Promise<string | null> => {
        const supabase = createClient()
        const route = processed.route
        if (route) {
            const path = `${id}/route.gpx`
            const { error: upError } = await supabase.storage.from(ROUTE_BUCKET).upload(
                path, new Blob([route.gpxText], { type: "application/gpx+xml" }),
                { upsert: true, contentType: "application/gpx+xml" },
            )
            if (upError) return upError.message
            const { error } = await supabase.from("practices")
                .update({ route_path: path, route_line: route.line, elevation_gain_m: route.elevationGainM })
                .eq("id", id)
            return error?.message ?? null
        }
        if (removeRoute && savedRoute) {
            const { error: rmError } = await supabase.storage.from(ROUTE_BUCKET).remove([savedRoute.path])
            if (rmError) return rmError.message
            const { error } = await supabase.from("practices")
                .update({ route_path: null, route_line: null, elevation_gain_m: null })
                .eq("id", id)
            return error?.message ?? null
        }
        return null
    }

    // 主催者は選んだ参加メンバーから選ぶ
    const organizerOptions = useMemo(() => members.filter(m => participants.has(m.user_id)), [members, participants])

    const change = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setDirty(true) }

    const handleParticipants = (next: Set<string>) => {
        setParticipants(next)
        if (organizerId && !next.has(organizerId)) setOrganizerId("")
        setDirty(true)
    }

    const backHref = practiceId != null ? `/practices/${practiceId}` : "/practices"

    const handleSave = async () => {
        const distance = parseKm(distanceStr)
        if (!heldOn) { setMessage({ text: "日付を入力してください", isError: true }); return }
        if (distance === undefined) { setMessage({ text: "距離は km の数値で入力してください（例: 15.5）", isError: true }); return }
        if (participants.size === 0) { setMessage({ text: "参加メンバーを1人以上選んでください", isError: true }); return }
        if (gpxPoints && !processed.route) { setMessage({ text: processed.error, isError: true }); return }
        setSaving(true)
        const { data, error } = await createClient().rpc("save_practice", {
            p_id: practiceId ?? null,
            p_held_on: heldOn,
            p_title: title,
            p_organizer_id: organizerId || null,
            p_distance_km: distance,
            p_memo: memo,
            p_participants: [...participants],
        })
        if (error) { setSaving(false); setMessage({ text: `保存に失敗しました: ${error.message}`, isError: true }); return }
        const routeError = await saveRoute(data as number)
        setSaving(false)
        setDirty(false)
        // 練習録は保存できているので、ルートだけ失敗したときも詳細ページへ進む
        if (routeError) alert(`練習録は保存しましたが、ルートの保存に失敗しました（${routeError}）。編集画面からもう一度 GPX を選んでください。`)
        router.push(`/practices/${data}`)
    }

    const handleDelete = async () => {
        if (practiceId == null || !confirm("この練習録を削除しますか？ 参加メンバーのコメントとルートも消えます。")) return
        const supabase = createClient()
        // ルートのファイルを先に消す（練習録を先に消すと、編集できる人の判定ができずファイルを消せなくなる）
        if (savedRoute) {
            const { error: rmError } = await supabase.storage.from(ROUTE_BUCKET).remove([savedRoute.path])
            if (rmError) { setMessage({ text: `ルートの削除に失敗しました: ${rmError.message}`, isError: true }); return }
        }
        const { error } = await supabase.from("practices").delete().eq("id", practiceId)
        if (error) { setMessage({ text: `削除に失敗しました: ${error.message}`, isError: true }); return }
        setDirty(false)
        router.push("/practices")
    }

    if (status === "loading") return <p className="p-4">読み込み中...</p>
    if (status === "notFound") return <p className="p-4">練習録が見つからないか、編集できません。</p>

    const inputClass = "border rounded px-2 py-1 bg-white"

    return (
        <div className="max-w-3xl mx-auto p-4 text-black">
            <Link href={backHref} className="text-sm text-blue-600 hover:underline">← 戻る</Link>
            <h1 className="text-2xl font-bold mt-2 mb-4">{practiceId != null ? "練習録の編集" : "練習録を追加"}</h1>

            <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-4">
                    <label className="flex flex-col gap-1">
                        <span className="font-semibold">日付</span>
                        <input type="date" value={heldOn} onChange={e => change(setHeldOn)(e.target.value)} className={inputClass} />
                    </label>
                    <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
                        <span className="font-semibold">タイトル <span className="text-xs font-normal text-gray-500">（任意。例: 皇居ラン、30km走）</span></span>
                        <input value={title} maxLength={100} onChange={e => change(setTitle)(e.target.value)} className={inputClass} />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="font-semibold">距離（km）</span>
                        <input value={distanceStr} onChange={e => change(setDistanceStr)(e.target.value)} inputMode="decimal" placeholder="例: 15.5" className={`${inputClass} w-28`} />
                    </label>
                </div>

                <section className="flex flex-col gap-2">
                    <span className="font-semibold">ルート（GPX） <span className="text-xs font-normal text-gray-500">（任意）</span></span>
                    {savedRoute && !gpxPoints && (
                        <div className="flex flex-col gap-1">
                            {!removeRoute && <RouteMap line={savedRoute.line} className="h-64 w-full rounded border" />}
                            <label className="flex items-center gap-1 text-sm">
                                <input type="checkbox" checked={removeRoute} onChange={e => { setRemoveRoute(e.target.checked); setDirty(true) }} />
                                登録済みのルートを削除する
                            </label>
                        </div>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                        <input type="file" accept=".gpx,application/gpx+xml" onChange={e => handleFile(e.target.files?.[0])} />
                        {gpxPoints && (
                            <label className="flex items-center gap-1">
                                スタート・ゴールから
                                <select value={trimM} onChange={e => { setTrimM(Number(e.target.value)); setDirty(true) }} className={inputClass}>
                                    {TRIM_OPTIONS.map(m => <option key={m} value={m}>{m === 0 ? "消さない" : `${m}m`}</option>)}
                                </select>
                                以内を消す
                            </label>
                        )}
                    </div>
                    {gpxError && <p className="text-sm text-red-600">{gpxError}</p>}
                    {gpxPoints && processed.error && <p className="text-sm text-red-600">{processed.error}</p>}
                    {processed.route && (
                        <div className="flex flex-col gap-1">
                            <p className="text-sm">
                                {gpxName}: 距離 {formatKm(processed.route.distanceKm)}
                                {processed.route.elevationGainM != null && `・累積標高 ${processed.route.elevationGainM}m`}
                                {distanceStr.trim() !== String(processed.route.distanceKm) && (
                                    <button type="button" onClick={() => change(setDistanceStr)(String(processed.route!.distanceKm))} className="ml-2 text-blue-600 hover:underline">
                                        この距離を使う
                                    </button>
                                )}
                            </p>
                            <RouteMap line={processed.route.line} className="h-64 w-full rounded border" />
                            <p className="text-xs text-gray-500">
                                地図の線が保存される範囲です。自宅などが分からないよう、スタート・ゴール付近が消えていることを確かめてください。
                                保存する GPX には位置と標高だけを入れ、時刻・心拍などは入れません。
                            </p>
                        </div>
                    )}
                    <p className="text-xs text-gray-500">
                        GPX の書き出し方: Strava はアクティビティの「…」→「GPX をエクスポート」、Garmin Connect はアクティビティの歯車 →「GPX にエクスポート」。
                    </p>
                </section>

                <div className="flex flex-col gap-1">
                    <span className="font-semibold">参加メンバー</span>
                    <MemberPicker
                        members={members}
                        selected={participants}
                        onChange={handleParticipants}
                        onAdded={m => setMembers(prev => [...prev, m])}
                    />
                </div>

                <label className="flex flex-col gap-1">
                    <span className="font-semibold">主催者</span>
                    <select value={organizerId} onChange={e => change(setOrganizerId)(e.target.value)} className={`${inputClass} w-56`}>
                        <option value="">なし</option>
                        {organizerOptions.map(m => <option key={m.user_id} value={m.user_id}>{m.name || "名前未設定"}</option>)}
                    </select>
                    <span className="text-xs text-gray-500">参加メンバーの中から選びます</span>
                </label>

                <label className="flex flex-col gap-1">
                    <span className="font-semibold">主催者コメント <span className="text-xs font-normal text-gray-500">（任意。集合場所・練習内容・振り返りなど）</span></span>
                    <textarea value={memo} maxLength={MEMO_MAX} onChange={e => change(setMemo)(e.target.value)} rows={4} className="w-full border rounded p-2 bg-white" />
                    <span className="text-xs text-gray-500 text-right">{memo.length} / {MEMO_MAX}</span>
                </label>
            </div>

            <div className="mt-4 flex items-center gap-3">
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                    {saving ? "保存中..." : "保存"}
                </button>
                {practiceId != null && (
                    <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">削除</button>
                )}
                {dirty && <span className="text-sm text-gray-500">未保存の変更があります</span>}
            </div>
            {message && <p className={`mt-2 text-sm ${message.isError ? "text-red-600" : "text-green-700"}`}>{message.text}</p>}
            <p className="mt-4 text-xs text-gray-500">
                ※ 練習録は作った人と管理者が編集できます。コメントは参加メンバーが練習録のページから書きます。
            </p>
        </div>
    )
}
