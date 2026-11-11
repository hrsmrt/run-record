"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { VIEWER_ROLE } from "@/lib/viewer"
import { markSeen } from "@/lib/seen"
import { LinkifiedText } from "@/components/CommentText"
import { EnrollmentTag } from "@/components/EnrollmentTag"
import { MessageThread, formatDateTime } from "@/components/MessageThread"
import { DatePoll } from "@/components/DatePoll"
import { ThreadRoutes } from "@/components/ThreadRoutes"
import { BOARD_TEXT_MAX, BOARD_THREAD_TITLE_MAX, THREAD_ROUTE_COLUMNS, type BoardPost, type BoardThread, type DateOption, type DateVote, type ThreadRoute } from "@/lib/board"

// 掲示板の話題（本文・日程調整・ルート案・返信）
export function BoardThreadDetail({ id }: { id: number }) {
    const router = useRouter()
    const [thread, setThread] = useState<BoardThread | null | undefined>(undefined)
    const [posts, setPosts] = useState<BoardPost[]>([])
    const [options, setOptions] = useState<DateOption[]>([])
    const [votes, setVotes] = useState<DateVote[]>([])
    const [routes, setRoutes] = useState<ThreadRoute[]>([])
    const [isMember, setIsMember] = useState(false)
    const [isAdmin, setIsAdmin] = useState(false)
    const [editing, setEditing] = useState(false)
    const [title, setTitle] = useState("")
    const [body, setBody] = useState("")
    const [error, setError] = useState("")

    const load = useCallback(async () => {
        const supabase = createClient()
        const [{ data: t }, { data: ps }, { data: os }, { data: vs }, { data: rs }, { data: claims }] = await Promise.all([
            supabase.from("public_board_threads").select("*").eq("id", id).maybeSingle(),
            supabase.from("public_board_posts").select("*").eq("thread_id", id).order("created_at"),
            supabase.from("public_thread_date_options").select("*").eq("thread_id", id),
            supabase.from("public_thread_date_votes").select("*").eq("thread_id", id),
            supabase.from("public_thread_routes").select(THREAD_ROUTE_COLUMNS).eq("thread_id", id).order("created_at"),
            supabase.auth.getClaims(),
        ])
        setThread((t as BoardThread | null) ?? null)
        setPosts((ps ?? []) as BoardPost[])
        setOptions((os ?? []) as DateOption[])
        setVotes((vs ?? []) as DateVote[])
        setRoutes((rs ?? []) as ThreadRoute[])
        const c = claims?.claims
        setIsMember(!!c && c.app_metadata?.role !== VIEWER_ROLE)
        setIsAdmin(c?.app_metadata?.role === "admin" && c?.aal === "aal2")
    }, [id])

    // 開いたら新着の印を消す（読み込み後にもう一度。自分の書き込みで新着にならないように）
    useEffect(() => { load().then(() => markSeen("thread", id)) }, [load, id])
    const reload = () => load().then(() => markSeen("thread", id))

    const result = async (p: PromiseLike<{ error: { message: string } | null }>, failText: string) => {
        const { error } = await p
        if (error) return `${failText}: ${error.message}`
        await reload()
        return null
    }

    const saveThread = async () => {
        if (title.trim() === "") { setError("タイトルを入力してください"); return }
        const err = await result(
            createClient().from("board_threads").update({ title: title.trim(), body: body.trim() || null, updated_at: new Date().toISOString() }).eq("id", id),
            "保存に失敗しました",
        )
        if (err) { setError(err); return }
        setEditing(false)
        setError("")
    }

    const deleteThread = async () => {
        if (!confirm("この話題を削除しますか？ 返信・日程調整・ルート案もすべて消えます。")) return
        const { error } = await createClient().from("board_threads").delete().eq("id", id)
        if (error) { setError(`削除に失敗しました: ${error.message}`); return }
        router.push("/board")
    }

    if (thread === undefined) return <p className="p-4">読み込み中...</p>
    if (thread === null) return <p className="p-4">話題が見つかりませんでした。</p>

    return (
        <div className="max-w-4xl mx-auto p-4 text-black flex flex-col gap-4">
            <Link href="/board" className="text-sm text-blue-600 hover:underline">← 掲示板</Link>
            {editing ? (
                <div className="flex flex-col gap-2 bg-white p-3">
                    <input value={title} maxLength={BOARD_THREAD_TITLE_MAX} onChange={e => setTitle(e.target.value)} className="border rounded px-2 py-1 font-bold" aria-label="タイトル" />
                    <textarea value={body} maxLength={BOARD_TEXT_MAX} onChange={e => setBody(e.target.value)} rows={6} className="w-full border rounded p-2 text-sm" aria-label="本文" />
                    <div className="flex gap-3">
                        <button onClick={saveThread} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">保存</button>
                        <button onClick={() => setEditing(false)} className="text-sm text-gray-600 hover:underline">やめる</button>
                    </div>
                </div>
            ) : (
                <article className="bg-white p-3 flex flex-col gap-2">
                    <div className="flex flex-wrap items-baseline gap-3">
                        <h1 className="text-xl font-bold">{thread.title}</h1>
                        {thread.can_edit && (
                            <>
                                <button onClick={() => { setTitle(thread.title); setBody(thread.body ?? ""); setEditing(true) }} className="text-sm text-blue-600 hover:underline">編集</button>
                                <button onClick={deleteThread} className="text-sm text-red-600 hover:underline">削除</button>
                            </>
                        )}
                    </div>
                    <p className="text-xs text-gray-600">
                        <span className={thread.author_gender === "female" ? "text-red-600" : ""}>
                            {thread.author_name ?? "（退会したメンバー）"}<EnrollmentTag year={thread.author_enrollment_year} />
                        </span>
                        ・{formatDateTime(thread.created_at)}
                    </p>
                    {thread.body && <div className="text-sm"><LinkifiedText text={thread.body} /></div>}
                </article>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}

            {(options.length > 0 || thread.can_edit) && (
                <section className="flex flex-col gap-1">
                    <h2 className="font-bold">日程調整</h2>
                    <DatePoll
                        threadId={id}
                        threadTitle={thread.title}
                        options={options}
                        votes={votes}
                        canVote={isMember}
                        canEdit={thread.can_edit}
                        decidedPracticeId={thread.decided_practice_id}
                        onChanged={reload}
                    />
                </section>
            )}

            {(routes.length > 0 || isMember) && (
                <section className="flex flex-col gap-1">
                    <h2 className="font-bold">ルート案{routes.length > 0 && `（${routes.length}件）`}</h2>
                    <ThreadRoutes
                        threadId={id}
                        threadTitle={thread.title}
                        routes={routes}
                        canAdd={isMember}
                        canEditThread={thread.can_edit}
                        onChanged={reload}
                    />
                </section>
            )}

            <section className="flex flex-col gap-1">
                <h2 className="font-bold">返信{posts.length > 0 && `（${posts.length}件）`}</h2>
                <MessageThread
                    messages={posts}
                    canPost={isMember}
                    maxLength={BOARD_TEXT_MAX}
                    placeholder="返信を書く"
                    onPost={body => result(createClient().from("board_posts").insert({ thread_id: id, body }), "書き込みに失敗しました")}
                    onUpdate={(postId, body) => result(createClient().from("board_posts").update({ body, updated_at: new Date().toISOString() }).eq("id", postId), "保存に失敗しました")}
                    onDelete={postId => result(createClient().from("board_posts").delete().eq("id", postId), "削除に失敗しました")}
                    canDeleteAny={isAdmin}
                />
            </section>
        </div>
    )
}
