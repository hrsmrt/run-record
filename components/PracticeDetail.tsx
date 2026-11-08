"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { LinkifiedText } from "@/components/CommentText"
import { EnrollmentTag } from "@/components/EnrollmentTag"
import { formatDate } from "@/components/RaceGroups"
import { useUnsavedWarning } from "@/lib/use-unsaved-warning"
import { RouteMap } from "@/components/RouteMap"
import { ElevationChart } from "@/components/ElevationChart"
import { RsvpPanel } from "@/components/RsvpPanel"
import { MessageThread } from "@/components/MessageThread"
import { markSeen } from "@/lib/seen"
import { VIEWER_ROLE } from "@/lib/viewer"
import {
    type Practice, type PracticeComment, type PracticeMessage, type PracticeParticipant, type PracticeRsvp,
    compareParticipants, formatKm, formatStartTime, isUpcoming, practiceTitle, todayStr,
} from "@/lib/practices"

const MESSAGE_MAX = 2000

const COMMENT_MAX = 5000

// 更新日時（TIMESTAMPTZ）をブラウザのタイムゾーンの日付で表示する
const formatLocalDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
}

// 練習録の詳細（基本情報・参加の回答・やりとり・参加メンバー・コメント）。
// 予定（今日以降）は参加ボタン、終わった練習は参加メンバーのコメント（1人1件）を中心に出す
export function PracticeDetail({ id }: { id: number }) {
    const [practice, setPractice] = useState<Practice | null | undefined>(undefined)
    const [participants, setParticipants] = useState<PracticeParticipant[]>([])
    const [comments, setComments] = useState<PracticeComment[]>([])
    const [rsvps, setRsvps] = useState<PracticeRsvp[]>([])
    const [messages, setMessages] = useState<PracticeMessage[]>([])
    // 閲覧用アカウントは読むだけ。管理者（2段階認証済み）は他人の書き込みも消せる
    const [isMember, setIsMember] = useState(false)
    const [isAdmin, setIsAdmin] = useState(false)
    const [draft, setDraft] = useState("")
    const [editing, setEditing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

    const mine = comments.find(c => c.is_mine)
    useUnsavedWarning(editing && draft !== (mine?.body ?? ""))

    const load = useCallback(async () => {
        const supabase = createClient()
        const [{ data: pr }, { data: pps }, { data: cs }, { data: rs }, { data: ms }, { data: claims }] = await Promise.all([
            supabase.from("public_practices").select("*").eq("id", id).maybeSingle(),
            supabase.from("public_practice_participants").select("*").eq("practice_id", id),
            supabase.from("public_practice_comments").select("*").eq("practice_id", id).order("created_at"),
            supabase.from("public_practice_rsvps").select("*").eq("practice_id", id).order("updated_at"),
            supabase.from("public_practice_messages").select("*").eq("practice_id", id).order("created_at"),
            supabase.auth.getClaims(),
        ])
        setPractice((pr as Practice | null) ?? null)
        setParticipants(((pps ?? []) as PracticeParticipant[]).sort(compareParticipants))
        setComments((cs ?? []) as PracticeComment[])
        setRsvps((rs ?? []) as PracticeRsvp[])
        setMessages((ms ?? []) as PracticeMessage[])
        const c = claims?.claims
        setIsMember(!!c && c.app_metadata?.role !== VIEWER_ROLE)
        setIsAdmin(c?.app_metadata?.role === "admin" && c?.aal === "aal2")
    }, [id])

    // 開いたら新着の印を消す（読み込み後にもう一度。自分の書き込みで新着にならないように）
    useEffect(() => { load().then(() => markSeen("practice", id)) }, [load, id])
    const reload = () => load().then(() => markSeen("practice", id))

    const postMessage = async (body: string) => {
        const { error } = await createClient().from("practice_messages").insert({ practice_id: id, body })
        if (error) return `書き込みに失敗しました: ${error.message}`
        await reload()
        return null
    }
    const updateMessage = async (messageId: number, body: string) => {
        const { error } = await createClient().from("practice_messages").update({ body, updated_at: new Date().toISOString() }).eq("id", messageId)
        if (error) return `保存に失敗しました: ${error.message}`
        await reload()
        return null
    }
    const deleteMessage = async (messageId: number) => {
        const { error } = await createClient().from("practice_messages").delete().eq("id", messageId)
        if (error) return `削除に失敗しました: ${error.message}`
        await reload()
        return null
    }

    // 予定を終えて練習録にする（「参加」の人を参加メンバーに入れ、記録済みにする。作った人・管理者）
    const finishPractice = async () => {
        if (!confirm("練習を終了して練習録にしますか？ 「参加」と答えた人は参加メンバーに追加されます。")) return
        const { data, error } = await createClient().rpc("finish_practice", { p_practice_id: id })
        if (error) { setMessage({ text: `登録に失敗しました: ${error.message}`, isError: true }); return }
        setMessage({ text: `練習録にしました（参加メンバーに${data ?? 0}人を追加）。感想コメントや GPX を追加できます`, isError: false })
        reload()
    }

    // 記録済みの練習で、あとから「参加」と答えた人を参加メンバーに入れる（作った人・管理者）
    const applyRsvps = async () => {
        if (!confirm("「参加」と答えた人を参加メンバーに追加しますか？（すでに参加メンバーの人はそのまま）")) return
        const { data, error } = await createClient().rpc("apply_rsvps_to_participants", { p_practice_id: id })
        if (error) { setMessage({ text: `追加に失敗しました: ${error.message}`, isError: true }); return }
        setMessage({ text: `${data ?? 0}人を参加メンバーに追加しました`, isError: false })
        reload()
    }

    // 一時的な署名付き URL でダウンロードする（ファイル置き場は非公開のため）
    const handleDownload = async () => {
        if (!practice?.route_path) return
        const { data, error } = await createClient().storage.from("practice-routes")
            .createSignedUrl(practice.route_path, 60, { download: `practice-${practice.held_on}.gpx` })
        if (error || !data) { setMessage({ text: `ダウンロードできませんでした: ${error?.message ?? ""}`, isError: true }); return }
        window.location.assign(data.signedUrl)
    }

    const startEdit = () => { setDraft(mine?.body ?? ""); setEditing(true); setMessage(null) }

    const handleSave = async () => {
        if (draft.trim() === "") { setMessage({ text: "コメントを入力してください", isError: true }); return }
        setSaving(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setSaving(false); setMessage({ text: "ログインしてください", isError: true }); return }
        const { error } = await supabase.from("practice_comments").upsert(
            { practice_id: id, user_id: user.id, body: draft, updated_at: new Date().toISOString() },
            { onConflict: "practice_id,user_id" },
        )
        setSaving(false)
        if (error) { setMessage({ text: `保存に失敗しました: ${error.message}`, isError: true }); return }
        setEditing(false)
        setMessage({ text: "コメントを保存しました", isError: false })
        load()
    }

    const handleDelete = async () => {
        if (!mine || !confirm("自分のコメントを削除しますか？")) return
        const { error } = await createClient().from("practice_comments").delete().eq("id", mine.id)
        if (error) { setMessage({ text: `削除に失敗しました: ${error.message}`, isError: true }); return }
        setEditing(false)
        load()
    }

    if (practice === undefined) return <p className="p-4">読み込み中...</p>
    if (practice === null) return <p className="p-4">練習録が見つかりませんでした。</p>
    const upcoming = isUpcoming(practice)

    return (
        <div className="max-w-4xl mx-auto p-4 text-black flex flex-col gap-4">
            <div>
                <Link href="/practices" className="text-sm text-blue-600 hover:underline">← 練習録一覧</Link>
                <div className="flex flex-wrap items-baseline gap-3 mt-2">
                    <h1 className="text-2xl font-bold">{practiceTitle(practice)}</h1>
                    <span className="font-mono">{formatDate(practice.held_on)}</span>
                    {practice.can_edit && (
                        <Link href={`/practices/${id}/edit`} className="text-sm text-blue-600 hover:underline">編集</Link>
                    )}
                </div>
            </div>

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 bg-white p-3 text-sm">
                {(practice.start_time || practice.meeting_place) && (
                    <>
                        <dt className="font-semibold">集合</dt>
                        <dd>{[formatStartTime(practice.start_time), practice.meeting_place].filter(Boolean).join("　")}</dd>
                    </>
                )}
                {practice.rsvp_deadline && upcoming && (
                    <>
                        <dt className="font-semibold">参加の締切</dt>
                        <dd>{formatDate(practice.rsvp_deadline)}</dd>
                    </>
                )}
                <dt className="font-semibold">主催者</dt>
                <dd className={practice.organizer_gender === "female" ? "text-red-600" : ""}>
                    {practice.organizer_name ?? "—"}<EnrollmentTag year={practice.organizer_enrollment_year} />
                </dd>
                <dt className="font-semibold">距離</dt>
                <dd>
                    {formatKm(practice.distance_km) || "—"}
                    {practice.elevation_gain_m != null && <span className="ml-3">累積標高 {practice.elevation_gain_m.toLocaleString()}m</span>}
                </dd>
                <dt className="font-semibold">参加</dt>
                <dd>{practice.participant_count}人</dd>
                {practice.memo && (
                    <>
                        <dt className="font-semibold">主催者コメント</dt>
                        <dd><LinkifiedText text={practice.memo} /></dd>
                    </>
                )}
            </dl>

            {practice.route_line && practice.route_line.length >= 2 && (
                <section className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                        <h2 className="font-bold">ルート</h2>
                        {practice.route_path && (
                            <button onClick={handleDownload} className="text-sm text-blue-600 hover:underline">GPX をダウンロード</button>
                        )}
                    </div>
                    <RouteMap line={practice.route_line} />
                    <div className="bg-white">
                        <ElevationChart line={practice.route_line} />
                    </div>
                    <p className="text-xs text-gray-500">※ スタート・ゴール付近は表示していない場合があります。</p>
                </section>
            )}

            {(upcoming || !practice.is_recorded || rsvps.length > 0) && (
                <section>
                    <div className="flex flex-wrap items-center gap-3 mb-1">
                        <h2 className="font-bold">参加の回答</h2>
                        {practice.can_edit && !practice.is_recorded && practice.held_on <= todayStr() && (
                            <button onClick={finishPractice} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm">練習を終了して練習録にする</button>
                        )}
                        {practice.can_edit && practice.is_recorded && rsvps.some(r => r.status === "yes") && (
                            <button onClick={applyRsvps} className="text-sm text-blue-600 hover:underline">「参加」の人を参加メンバーにする</button>
                        )}
                    </div>
                    <RsvpPanel
                        practiceId={id}
                        rsvps={rsvps}
                        canAnswer={isMember && upcoming}
                        closed={!!practice.rsvp_deadline && practice.rsvp_deadline < todayStr()}
                        onChanged={reload}
                    />
                </section>
            )}

            <section>
                <h2 className="font-bold mb-1">やりとり{messages.length > 0 && `（${messages.length}件）`}</h2>
                <MessageThread
                    messages={messages}
                    canPost={isMember}
                    maxLength={MESSAGE_MAX}
                    placeholder="集合場所・ペースの相談、質問など（メンバーなら誰でも書けます）"
                    onPost={postMessage}
                    onUpdate={updateMessage}
                    onDelete={deleteMessage}
                    canDeleteAny={isAdmin}
                />
            </section>

            <section>
                <h2 className="font-bold mb-1">参加メンバー</h2>
                <ul className="flex flex-wrap gap-x-4 gap-y-1 bg-white p-3 text-sm">
                    {participants.map((p, i) => (
                        <li key={i} className={p.gender === "female" ? "text-red-600" : ""}>
                            {p.name ?? "名前未設定"}<EnrollmentTag year={p.enrollment_year} />
                            {p.is_organizer && <span className="ml-1 text-xs px-1 rounded bg-gray-100 text-gray-600">主催</span>}
                        </li>
                    ))}
                </ul>
            </section>

            {message && (upcoming || !practice.is_recorded) && <p className={`text-sm ${message.isError ? "text-red-600" : "text-green-700"}`}>{message.text}</p>}
            {/* 参加メンバーのコメントは練習の後に書くもの。予定のうちは、書かれていれば表示する */}
            {(!upcoming || comments.length > 0) && <section>
                <div className="flex items-center gap-3 mb-1">
                    <h2 className="font-bold">参加メンバーのコメント{comments.length > 0 && `（${comments.length}件）`}</h2>
                    {practice.am_participant && !editing && (
                        <button onClick={startEdit} className="text-sm text-blue-600 hover:underline">
                            {mine ? "自分のコメントを編集" : "コメントを書く"}
                        </button>
                    )}
                </div>
                {editing && (
                    <div className="mb-3 flex flex-col gap-1">
                        <textarea
                            value={draft}
                            maxLength={COMMENT_MAX}
                            onChange={e => setDraft(e.target.value)}
                            rows={6}
                            className="w-full border rounded p-2 bg-white text-sm"
                            placeholder="練習の感想・コース・ペースなど"
                        />
                        <div className="flex items-center gap-3">
                            <button onClick={handleSave} disabled={saving} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm">
                                {saving ? "保存中..." : "保存"}
                            </button>
                            <button onClick={() => setEditing(false)} className="text-sm text-gray-600 hover:underline">やめる</button>
                            {mine && <button onClick={handleDelete} className="text-sm text-red-600 hover:underline">削除</button>}
                            <span className="ml-auto text-xs text-gray-500">{draft.length} / {COMMENT_MAX}</span>
                        </div>
                        <p className="text-xs text-gray-500">※ 改行はそのまま表示されます。URL を書くとリンクになります。</p>
                    </div>
                )}
                {message && <p className={`mb-2 text-sm ${message.isError ? "text-red-600" : "text-green-700"}`}>{message.text}</p>}
                {comments.length === 0 && !editing && <p className="text-sm text-gray-500">まだコメントはありません。</p>}
                <div className="flex flex-col gap-3">
                    {comments.map(c => (
                        <article key={c.id} className="bg-white p-3 border rounded text-sm">
                            <header className="flex flex-wrap items-center gap-2 mb-1">
                                <span className={`font-bold ${c.author_gender === "female" ? "text-red-600" : ""}`}>
                                    {c.author_name ?? "名前未設定"}<EnrollmentTag year={c.author_enrollment_year} />
                                </span>
                                <span className="text-xs text-gray-500">更新 {formatLocalDate(c.updated_at)}</span>
                            </header>
                            <LinkifiedText text={c.body} />
                        </article>
                    ))}
                </div>
            </section>}
        </div>
    )
}
