import Link from "next/link"

export type EditionThread = { id: number; title: string; edition_id: number | null }

// 大会（開催回）に結び付いた掲示板の話題へのリンクと、「掲示板で相談する」（その大会に結び付けて話題を立てる）
export function EditionThreads({ editionId, threads, canCreate }: {
    editionId: number
    threads: EditionThread[]
    // 閲覧用アカウントは話題を立てられない
    canCreate: boolean
}) {
    if (threads.length === 0 && !canCreate) return null
    return (
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
            {threads.length > 0 && <span className="text-gray-600">掲示板:</span>}
            {threads.map(t => (
                <Link key={t.id} href={`/board/${t.id}`} className="text-blue-600 hover:underline">{t.title}</Link>
            ))}
            {canCreate && (
                <Link href={`/board/new?edition=${editionId}`} className="text-blue-600 hover:underline">
                    {threads.length > 0 ? "別の話題を立てる" : "掲示板で相談する"}
                </Link>
            )}
        </p>
    )
}
