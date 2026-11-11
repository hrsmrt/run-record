"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { fetchAll } from "@/lib/fetch-all"
import { RaceGroup, RaceGroupRecords, RaceGroupTitle, fetchRaceGroups, formatDate } from "@/components/RaceGroups"
import { EnrollmentTag } from "@/components/EnrollmentTag"
import {
    PRACTICE_LIST_COLUMNS, type Practice, type PracticeParticipant,
    compareParticipants, formatKm, isUpcoming, practiceTitle,
} from "@/lib/practices"
import { UpcomingPractices } from "@/components/UpcomingPractices"
import { RecruitingRaces } from "@/components/RecruitingRaces"
import { BoardThreadItem } from "@/components/BoardList"
import { NewBadge } from "@/components/NewBadge"
import { BOARD_THREAD_COLUMNS, type BoardThread } from "@/lib/board"
import { isNew } from "@/lib/seen"

// 掲示板は新着を先に、残りを最近動きがあった順で、合わせて BOARD_COUNT 件出す
// （新着かはブラウザに覚えた日時で決まるので、多めに取って画面側で並べ直す）
const BOARD_COUNT = 5
const BOARD_FETCH = 30

type NewCounts = { plans: number; board: number; practices: number }

// 最初に表示する件数と、「さらに表示」で増やす件数
const PAGE = 15

type FeedItem =
    | { kind: "race"; date: string; key: string; group: RaceGroup }
    | { kind: "practice"; date: string; key: string; practice: Practice; participants: PracticeParticipant[] }

const Badge = ({ kind }: { kind: FeedItem["kind"] }) => kind === "race"
    ? <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-normal">大会</span>
    : <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-normal">練習</span>

// ホーム: 上に参加者募集中の大会、今後の練習予定と掲示板の最近の話題、その下に大会の記録と練習録を日付の新しい順に混ぜて表示する
export function HomeFeed() {
    const [items, setItems] = useState<FeedItem[] | null>(null)
    const [upcoming, setUpcoming] = useState<Practice[]>([])
    const [threads, setThreads] = useState<BoardThread[]>([])
    const [newCounts, setNewCounts] = useState<NewCounts>({ plans: 0, board: 0, practices: 0 })
    const [shownCount, setShownCount] = useState(PAGE)
    const [error, setError] = useState("")

    useEffect(() => {
        const load = async () => {
            const supabase = createClient()
            const [groups, practices, participants, { data: threadData }] = await Promise.all([
                fetchRaceGroups(supabase),
                fetchAll<Practice>((from, to) => supabase.from("public_practices").select(PRACTICE_LIST_COLUMNS)
                    .order("held_on", { ascending: false }).order("id", { ascending: false }).range(from, to)),
                fetchAll<PracticeParticipant>((from, to) => supabase.from("public_practice_participants").select("*")
                    .order("practice_id").range(from, to)),
                supabase.from("public_board_threads").select(BOARD_THREAD_COLUMNS)
                    .order("last_activity_at", { ascending: false }).limit(BOARD_FETCH),
            ])
            // 予定（今日以降）は上にまとめ、日付の近い順にする
            const plans = practices.filter(isUpcoming).reverse()
            setUpcoming(plans)
            const allThreads = (threadData ?? []) as BoardThread[]
            const newThreads = allThreads.filter(t => isNew("thread", t.id, t.last_activity_at))
            setThreads([...newThreads, ...allThreads.filter(t => !newThreads.includes(t))].slice(0, BOARD_COUNT))
            setNewCounts({
                plans: plans.filter(p => isNew("practice", p.id, p.last_activity_at)).length,
                board: newThreads.length,
                practices: practices.filter(p => !isUpcoming(p) && isNew("practice", p.id, p.last_activity_at)).length,
            })
            const byPractice = new Map<number, PracticeParticipant[]>()
            for (const p of participants) byPractice.set(p.practice_id, [...(byPractice.get(p.practice_id) ?? []), p])
            const merged: FeedItem[] = [
                ...groups.map(g => ({ kind: "race" as const, date: g.date, key: `race-${g.key}`, group: g })),
                ...practices.filter(p => !isUpcoming(p)).map(p => ({
                    kind: "practice" as const, date: p.held_on, key: `practice-${p.id}`, practice: p,
                    participants: (byPractice.get(p.id) ?? []).sort(compareParticipants),
                })),
            ]
            // 日付の新しい順。同じ日は大会を先に（並べ替えは安定なので、それぞれの中の順は保たれる）
            merged.sort((a, b) => b.date.localeCompare(a.date) || (a.kind === b.kind ? 0 : a.kind === "race" ? -1 : 1))
            setItems(merged)
        }
        load().catch((e: Error) => setError(e.message))
    }, [])

    if (error) return <p className="text-sm text-red-600">読み込みに失敗しました: {error}</p>
    if (!items) return <p className="text-sm">読み込み中...</p>

    return (
        <div className="w-full max-w-4xl mx-auto flex flex-col gap-4 text-black">
            <NewsLine counts={newCounts} />
            <RecruitingRaces />
            <section id="home-plans" className="flex flex-col gap-1 scroll-mt-4">
                <h2 className="font-bold flex items-center gap-3">
                    今後の練習予定{newCounts.plans > 0 && <span className="text-xs font-normal text-red-600">新着 {newCounts.plans}件</span>}
                    <Link href="/practices" className="text-xs font-normal text-blue-600 hover:underline">練習録へ</Link>
                </h2>
                <UpcomingPractices practices={upcoming} />
            </section>
            {threads.length > 0 && (
                <section id="home-board" className="flex flex-col gap-1 scroll-mt-4">
                    <h2 className="font-bold flex items-center gap-3">
                        掲示板{newCounts.board > 0 && <span className="text-xs font-normal text-red-600">新着 {newCounts.board}件</span>}
                        <Link href="/board" className="text-xs font-normal text-blue-600 hover:underline">すべての話題</Link>
                    </h2>
                    <ul className="flex flex-col gap-1">
                        {threads.map(t => <BoardThreadItem key={t.id} thread={t} />)}
                    </ul>
                </section>
            )}
            <h2 id="home-feed" className="font-bold mt-2 flex items-center gap-3 scroll-mt-4">
                最近の記録・練習{newCounts.practices > 0 && <span className="text-xs font-normal text-red-600">練習の新着 {newCounts.practices}件</span>}
            </h2>
            {items.length === 0 && <p className="text-sm">まだ記録も練習録もありません。</p>}
            {items.slice(0, shownCount).map(item => item.kind === "race" ? (
                <section key={item.key} className="bg-white p-2">
                    <h2 className="text-sm md:text-base font-bold mb-1 flex flex-wrap items-center gap-x-2">
                        <Badge kind="race" />
                        <span>{formatDate(item.date)}</span>
                        <span><RaceGroupTitle group={item.group} /></span>
                        <span className="text-xs font-normal text-gray-500">{item.group.records.length}人</span>
                    </h2>
                    <RaceGroupRecords records={item.group.records} />
                </section>
            ) : (
                <section key={item.key} className="bg-white p-2 text-sm">
                    <h2 className="md:text-base font-bold mb-1 flex flex-wrap items-center gap-x-2">
                        <Badge kind="practice" />
                        <span>{formatDate(item.date)}</span>
                        <Link href={`/practices/${item.practice.id}`} className="text-blue-600 hover:underline">{practiceTitle(item.practice)}</Link>
                        <NewBadge kind="practice" id={item.practice.id} at={item.practice.last_activity_at} />
                        {item.practice.distance_km != null && <span className="text-xs font-normal text-gray-500">{formatKm(item.practice.distance_km)}</span>}
                        {item.practice.has_route && <span className="text-xs font-normal px-1 rounded bg-green-50 text-green-700">ルート</span>}
                        {item.practice.comment_count > 0 && <span className="text-xs font-normal text-gray-500">コメント{item.practice.comment_count}件</span>}
                    </h2>
                    <p className="text-xs md:text-sm">
                        {item.participants.length}人:{" "}
                        {item.participants.map((p, i) => (
                            <span key={i} className={p.gender === "female" ? "text-red-600" : ""}>
                                {i > 0 && "、"}{p.name ?? "名前未設定"}<EnrollmentTag year={p.enrollment_year} />
                                {p.is_organizer && <span className="text-xs text-gray-500">（主催）</span>}
                            </span>
                        ))}
                    </p>
                    {item.practice.memo && <p className="mt-1 text-xs text-gray-600 line-clamp-2 whitespace-pre-line">{item.practice.memo}</p>}
                </section>
            ))}
            {shownCount < items.length && (
                <button onClick={() => setShownCount(n => n + PAGE)} className="self-center px-4 py-2 border rounded bg-white hover:bg-gray-50 text-sm">
                    さらに表示
                </button>
            )}
            <p className="text-sm text-center">
                すべての大会は <Link href="/races" className="text-blue-600 hover:underline">出場大会記録</Link>、
                すべての練習は <Link href="/practices" className="text-blue-600 hover:underline">練習録</Link> から
            </p>
        </div>
    )
}

// ホームの一番上のお知らせ。新着がある欄だけを出し、押すとその欄へ移動する
function NewsLine({ counts }: { counts: NewCounts }) {
    const parts = [
        { n: counts.plans, label: "練習予定", href: "#home-plans" },
        { n: counts.board, label: "掲示板", href: "#home-board" },
        { n: counts.practices, label: "練習録", href: "#home-feed" },
    ].filter(p => p.n > 0)
    if (parts.length === 0) return null
    return (
        <p className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm" role="status">
            <span className="font-bold text-red-600 mr-2">新着</span>
            {parts.map((p, i) => (
                <span key={p.href}>
                    {i > 0 && "・"}
                    <a href={p.href} className="text-blue-600 hover:underline">{p.label} {p.n}件</a>
                </span>
            ))}
        </p>
    )
}
