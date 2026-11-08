"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { LinkifiedText } from "@/components/CommentText"
import { EnrollmentTag } from "@/components/EnrollmentTag"
import { formatDate } from "@/components/RaceGroups"
import { useUnsavedWarning } from "@/lib/use-unsaved-warning"
import {
    type Practice, type PracticeComment, type PracticeParticipant,
    compareParticipants, formatKm, practiceTitle,
} from "@/lib/practices"

const COMMENT_MAX = 5000

// 更新日時（TIMESTAMPTZ）をブラウザのタイムゾーンの日付で表示する
const formatLocalDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
}

// 練習録の詳細（基本情報・参加メンバー・コメント）。参加メンバーは自分のコメントを書ける
export function PracticeDetail({ id }: { id: number }) {
    const [practice, setPractice] = useState<Practice | null | undefined>(undefined)
    const [participants, setParticipants] = useState<PracticeParticipant[]>([])
    const [comments, setComments] = useState<PracticeComment[]>([])
    const [draft, setDraft] = useState("")
    const [editing, setEditing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

    const mine = comments.find(c => c.is_mine)
    useUnsavedWarning(editing && draft !== (mine?.body ?? ""))

    const load = useCallback(async () => {
        const supabase = createClient()
        const [{ data: pr }, { data: pps }, { data: cs }] = await Promise.all([
            supabase.from("public_practices").select("*").eq("id", id).maybeSingle(),
            supabase.from("public_practice_participants").select("*").eq("practice_id", id),
            supabase.from("public_practice_comments").select("*").eq("practice_id", id).order("created_at"),
        ])
        setPractice((pr as Practice | null) ?? null)
        setParticipants(((pps ?? []) as PracticeParticipant[]).sort(compareParticipants))
        setComments((cs ?? []) as PracticeComment[])
    }, [id])

    useEffect(() => { load() }, [load])

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
                <dt className="font-semibold">主催者</dt>
                <dd className={practice.organizer_gender === "female" ? "text-red-600" : ""}>
                    {practice.organizer_name ?? "—"}<EnrollmentTag year={practice.organizer_enrollment_year} />
                </dd>
                <dt className="font-semibold">距離</dt>
                <dd>{formatKm(practice.distance_km) || "—"}</dd>
                <dt className="font-semibold">参加</dt>
                <dd>{practice.participant_count}人</dd>
                {practice.memo && (
                    <>
                        <dt className="font-semibold">主催者コメント</dt>
                        <dd><LinkifiedText text={practice.memo} /></dd>
                    </>
                )}
            </dl>

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

            <section>
                <div className="flex items-center gap-3 mb-1">
                    <h2 className="font-bold">コメント{comments.length > 0 && `（${comments.length}件）`}</h2>
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
            </section>
        </div>
    )
}
