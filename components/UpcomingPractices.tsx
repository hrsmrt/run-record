"use client"

import Link from "next/link"
import { formatDate } from "@/components/RaceGroups"
import { NewBadge } from "@/components/NewBadge"
import { type Practice, RSVP_LABELS, formatStartTime, practiceTitle, todayStr } from "@/lib/practices"

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"]
const weekday = (date: string) => WEEKDAYS[new Date(`${date}T00:00:00`).getDay()]

// 今後の練習予定（日付の近い順）。参加人数・自分の回答・やりとりの件数・新着を出す
export function UpcomingPractices({ practices }: { practices: Practice[] }) {
    if (practices.length === 0) return <p className="text-sm text-gray-500">今後の練習予定はありません。</p>
    const today = todayStr()
    return (
        <ul className="flex flex-col gap-1">
            {practices.map(p => {
                const closed = !!p.rsvp_deadline && p.rsvp_deadline < today
                return (
                    <li key={p.id} className="bg-white border-l-4 border-green-500 px-2 py-1.5 text-sm flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                        <span className="font-mono font-bold">
                            {formatDate(p.held_on)}（{weekday(p.held_on)}）{formatStartTime(p.start_time)}
                        </span>
                        <Link href={`/practices/${p.id}`} className="font-bold text-blue-600 hover:underline">{practiceTitle(p)}</Link>
                        <NewBadge kind="practice" id={p.id} at={p.last_activity_at} />
                        {p.meeting_place && <span className="text-xs text-gray-600">{p.meeting_place}</span>}
                        <span className="text-xs">
                            参加 {p.rsvp_yes_count}人{p.rsvp_maybe_count > 0 && `・検討中 ${p.rsvp_maybe_count}人`}
                        </span>
                        {p.my_rsvp
                            ? <span className="text-xs px-1 rounded bg-blue-50 text-blue-700">あなた: {RSVP_LABELS[p.my_rsvp]}</span>
                            : !closed && <span className="text-xs px-1 rounded bg-yellow-100 text-yellow-800">未回答</span>}
                        {p.rsvp_deadline && <span className="text-xs text-gray-500">{closed ? "締切済み" : `締切 ${formatDate(p.rsvp_deadline)}`}</span>}
                        {p.message_count > 0 && <span className="text-xs text-gray-500">やりとり{p.message_count}件</span>}
                    </li>
                )
            })}
        </ul>
    )
}
