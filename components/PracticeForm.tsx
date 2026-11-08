"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useUnsavedWarning } from "@/lib/use-unsaved-warning"
import { MemberPicker } from "@/components/MemberPicker"
import { type DirectoryMember, parseKm, todayStr } from "@/lib/practices"
import type { RoutePoint } from "@/lib/gpx"
import { RouteMap } from "@/components/RouteMap"
import { GpxPicker, type GpxSelection } from "@/components/GpxPicker"
import { RoutePlanner, type PlanSelection } from "@/components/RoutePlanner"

const ROUTE_BUCKET = "practice-routes"

const MEMO_MAX = 2000


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
    // 練習予定の項目
    const [startTime, setStartTime] = useState("")
    const [meetingPlace, setMeetingPlace] = useState("")
    const [rsvpDeadline, setRsvpDeadline] = useState("")
    // 当日の練習を「練習録（終わった練習）」にするか「予定」にするか。過去は記録済み、未来は予定に決まる
    const [isRecorded, setIsRecorded] = useState(true)
    // 掲示板の日程調整から作るときの話題 ID（保存後に「決まった練習」として結び付ける）
    const [fromThreadId, setFromThreadId] = useState<number | null>(null)
    const [participants, setParticipants] = useState<Set<string>>(new Set())
    // 登録済みのルート
    const [savedRoute, setSavedRoute] = useState<{ path: string; line: RoutePoint[] } | null>(null)
    // ルート案（地図で描いたもの。実際に走ったルートとは別）
    const [savedPlan, setSavedPlan] = useState<{ path: string; line: RoutePoint[] } | null>(null)
    const [plan, setPlan] = useState<PlanSelection>({ changed: false, route: null, computing: false })
    const [removeRoute, setRemoveRoute] = useState(false)
    // 新しく選んだ GPX
    const [gpx, setGpx] = useState<GpxSelection>({ hasFile: false, route: null, error: "" })
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
                // 日程調整から来たときは、日付・タイトルを入れておく（?date=&title=&thread=）
                const q = new URLSearchParams(window.location.search)
                const date = q.get("date")
                if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) setHeldOn(date)
                const t = q.get("title")
                if (t) setTitle(t.slice(0, 100))
                const thread = Number(q.get("thread"))
                if (Number.isInteger(thread) && thread > 0) setFromThreadId(thread)
                setStatus("ok")
                return
            }
            const { data: pr } = await supabase
                .from("practices")
                .select("held_on, title, organizer_id, distance_km, memo, route_path, route_line, start_time, meeting_place, rsvp_deadline, is_recorded, plan_route_path, plan_route_line")
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
            setStartTime(pr.start_time ? String(pr.start_time).substring(0, 5) : "")
            setMeetingPlace(pr.meeting_place ?? "")
            setRsvpDeadline(pr.rsvp_deadline ?? "")
            setIsRecorded(pr.is_recorded)
            if (pr.route_path && pr.route_line) setSavedRoute({ path: pr.route_path, line: pr.route_line as RoutePoint[] })
            if (pr.plan_route_path && pr.plan_route_line) setSavedPlan({ path: pr.plan_route_path, line: pr.plan_route_line as RoutePoint[] })
            setParticipants(new Set((pps ?? []).map(p => p.user_id as string)))
            setStatus("ok")
        }
        load()
    }, [practiceId])

    const handleGpx = (next: GpxSelection) => {
        setGpx(next)
        if (!next.hasFile) return
        setDirty(true)
        // 距離が空欄なら GPX の距離を入れる
        const km = next.route?.distanceKm
        if (km != null) setDistanceStr(prev => prev.trim() === "" ? String(km) : prev)
    }

    // 練習録を保存した後に、ルートを置き換える・消す。失敗したらメッセージを返す
    const saveRoute = async (id: number): Promise<string | null> => {
        const supabase = createClient()
        const route = gpx.route
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

    // ルート案を置き換える・消す（描き直したときだけ）。失敗したらメッセージを返す
    const savePlan = async (id: number): Promise<string | null> => {
        if (!plan.changed) return null
        const supabase = createClient()
        if (plan.route) {
            const path = `${id}/plan.gpx`
            const { error: upError } = await supabase.storage.from(ROUTE_BUCKET).upload(
                path, new Blob([plan.route.gpxText], { type: "application/gpx+xml" }),
                { upsert: true, contentType: "application/gpx+xml" },
            )
            if (upError) return upError.message
            const { error } = await supabase.from("practices").update({
                plan_route_path: path, plan_route_line: plan.route.line,
                plan_distance_km: plan.route.distanceKm, plan_elevation_gain_m: plan.route.elevationGainM,
            }).eq("id", id)
            return error?.message ?? null
        }
        if (savedPlan) {
            const { error: rmError } = await supabase.storage.from(ROUTE_BUCKET).remove([savedPlan.path])
            if (rmError) return rmError.message
            const { error } = await supabase.from("practices")
                .update({ plan_route_path: null, plan_route_line: null, plan_distance_km: null, plan_elevation_gain_m: null })
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
        if (participants.size === 0) { setMessage({ text: "参加メンバー（予定なら主催者）を1人以上選んでください", isError: true }); return }
        if (plan.changed && plan.computing) { setMessage({ text: "ルート案の標高を計算中です。少し待ってから保存してください", isError: true }); return }
        if (rsvpDeadline && rsvpDeadline > heldOn) { setMessage({ text: "参加の締切は練習の日付以前にしてください", isError: true }); return }
        if (gpx.hasFile && !gpx.route) { setMessage({ text: gpx.error, isError: true }); return }
        setSaving(true)
        const { data, error } = await createClient().rpc("save_practice", {
            p_id: practiceId ?? null,
            p_held_on: heldOn,
            p_title: title,
            p_organizer_id: organizerId || null,
            p_distance_km: distance,
            p_memo: memo,
            p_participants: [...participants],
            p_start_time: startTime || null,
            p_meeting_place: meetingPlace,
            p_rsvp_deadline: rsvpDeadline || null,
            p_is_recorded: heldOn < todayStr() ? true : heldOn > todayStr() ? false : isRecorded,
        })
        if (error) { setSaving(false); setMessage({ text: `保存に失敗しました: ${error.message}`, isError: true }); return }
        const routeError = [await saveRoute(data as number), await savePlan(data as number)].filter(Boolean).join(" / ")
        // 日程調整の話題に、決まった練習として結び付ける（話題を立てた人・管理者のときだけ反映される）
        if (fromThreadId != null && practiceId == null) {
            await createClient().from("board_threads").update({ decided_practice_id: data }).eq("id", fromThreadId)
        }
        setSaving(false)
        setDirty(false)
        // 練習録は保存できているので、ルートだけ失敗したときも詳細ページへ進む
        if (routeError) alert(`練習録は保存しましたが、ルート・ルート案の保存に失敗しました（${routeError}）。編集画面からもう一度登録してください。`)
        router.push(`/practices/${data}`)
    }

    const handleDelete = async () => {
        if (practiceId == null || !confirm("この練習録を削除しますか？ 参加メンバーのコメントとルートも消えます。")) return
        const supabase = createClient()
        // ルートのファイルを先に消す（練習録を先に消すと、編集できる人の判定ができずファイルを消せなくなる）
        const files = [savedRoute?.path, savedPlan?.path].filter((f): f is string => !!f)
        if (files.length > 0) {
            const { error: rmError } = await supabase.storage.from(ROUTE_BUCKET).remove(files)
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

                {heldOn === todayStr() ? (
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                        <span className="font-semibold">今日の練習を</span>
                        <label className="flex items-center gap-1">
                            <input type="radio" checked={isRecorded} onChange={() => change(setIsRecorded)(true)} />
                            練習録として登録する（終わった練習）
                        </label>
                        <label className="flex items-center gap-1">
                            <input type="radio" checked={!isRecorded} onChange={() => change(setIsRecorded)(false)} />
                            練習予定にする（参加を募集する）
                        </label>
                    </div>
                ) : (
                    <p className="text-xs text-gray-500">
                        {heldOn > todayStr() ? "日付が今日より後なので、練習予定になります（参加ボタンが出ます）。" : "日付が過ぎているので、練習録（終わった練習）になります。"}
                    </p>
                )}

                <fieldset className="flex flex-wrap gap-4 border rounded p-3">
                    <legend className="px-1 text-sm font-semibold">練習予定のとき <span className="text-xs font-normal text-gray-500">（任意）</span></legend>
                    <label className="flex flex-col gap-1">
                        <span className="text-sm">集合時刻</span>
                        <input type="time" value={startTime} onChange={e => change(setStartTime)(e.target.value)} className={inputClass} />
                    </label>
                    <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
                        <span className="text-sm">集合場所</span>
                        <input value={meetingPlace} maxLength={200} onChange={e => change(setMeetingPlace)(e.target.value)} placeholder="例: 竹橋駅 1b 出口" className={inputClass} />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-sm">参加の締切</span>
                        <input type="date" value={rsvpDeadline} max={heldOn} onChange={e => change(setRsvpDeadline)(e.target.value)} className={inputClass} />
                    </label>
                </fieldset>

                <section className="flex flex-col gap-2">
                    <span className="font-semibold">ルート案 <span className="text-xs font-normal text-gray-500">（任意。地図で描く。予定のときに参加者へ共有できます）</span></span>
                    <RoutePlanner
                        initialLine={savedPlan?.line ?? null}
                        onChange={next => { setPlan(next); if (next.changed) setDirty(true) }}
                    />
                </section>

                <section className="flex flex-col gap-2">
                    <span className="font-semibold">実際に走ったルート（GPX） <span className="text-xs font-normal text-gray-500">（任意）</span></span>
                    {savedRoute && !gpx.hasFile && (
                        <div className="flex flex-col gap-1">
                            {!removeRoute && <RouteMap line={savedRoute.line} className="h-64 w-full rounded border" />}
                            <label className="flex items-center gap-1 text-sm">
                                <input type="checkbox" checked={removeRoute} onChange={e => { setRemoveRoute(e.target.checked); setDirty(true) }} />
                                登録済みのルートを削除する
                            </label>
                        </div>
                    )}
                    <GpxPicker
                        defaultTrimM={300}
                        onChange={handleGpx}
                        summaryExtra={route => distanceStr.trim() !== String(route.distanceKm) && (
                            <button type="button" onClick={() => change(setDistanceStr)(String(route.distanceKm))} className="ml-2 text-blue-600 hover:underline">
                                この距離を使う
                            </button>
                        )}
                    />
                </section>

                <div className="flex flex-col gap-1">
                    <span className="font-semibold">参加メンバー</span>
                    <span className="text-xs text-gray-500">予定のときは主催者だけで大丈夫です。参加ボタンで「参加」した人は、練習後に詳細ページからまとめて参加メンバーにできます。</span>
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
                ※ 練習録は作った人と管理人が編集できます。コメントは参加メンバーが練習録のページから書きます。
            </p>
        </div>
    )
}
