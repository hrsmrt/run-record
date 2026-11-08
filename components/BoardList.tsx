"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { VIEWER_ROLE } from "@/lib/viewer"
import { fetchAll } from "@/lib/fetch-all"
import { NewBadge } from "@/components/NewBadge"
import { formatDateTime } from "@/components/MessageThread"
import type { BoardThread } from "@/lib/board"

// 掲示板の話題の一覧（最後に動きがあった順）
export function BoardList() {
    const [threads, setThreads] = useState<BoardThread[] | null>(null)
    const [canCreate, setCanCreate] = useState(false)
    const [error, setError] = useState("")

    useEffect(() => {
        const load = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            setCanCreate(!!user && user.app_metadata?.role !== VIEWER_ROLE)
            setThreads(await fetchAll<BoardThread>((from, to) => supabase.from("public_board_threads")
                .select("id, title, author_name, author_gender, author_enrollment_year, decided_practice_id, created_at, updated_at, post_count, has_poll, last_activity_at, is_mine, can_edit")
                .order("last_activity_at", { ascending: false }).range(from, to)))
        }
        load().catch((e: Error) => setError(e.message))
    }, [])

    if (error) return <p className="text-sm text-red-600">読み込みに失敗しました: {error}</p>
    if (!threads) return <p className="text-sm">読み込み中...</p>

    return (
        <div className="w-full max-w-4xl mx-auto flex flex-col gap-3 text-black">
            <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">{threads.length}件の話題</span>
                {canCreate && (
                    <Link href="/board/new" className="ml-auto px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">話題を立てる</Link>
                )}
            </div>
            {threads.length === 0 && <p className="text-sm">まだ話題はありません。</p>}
            <ul className="flex flex-col gap-1">
                {threads.map(t => <BoardThreadItem key={t.id} thread={t} />)}
            </ul>
        </div>
    )
}

export function BoardThreadItem({ thread: t }: { thread: BoardThread }) {
    return (
        <li className="bg-white px-2 py-1.5 text-sm flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <Link href={`/board/${t.id}`} className="font-bold text-blue-600 hover:underline">{t.title}</Link>
            <NewBadge kind="thread" id={t.id} at={t.last_activity_at} />
            {t.has_poll && (
                <span className={`text-xs px-1 rounded ${t.decided_practice_id ? "bg-gray-100 text-gray-600" : "bg-orange-100 text-orange-800"}`}>
                    {t.decided_practice_id ? "日程決定" : "日程調整中"}
                </span>
            )}
            <span className="text-xs text-gray-600">{t.author_name ?? "（退会したメンバー）"}</span>
            <span className="text-xs text-gray-500">返信{t.post_count}件・最終 {formatDateTime(t.last_activity_at)}</span>
        </li>
    )
}
