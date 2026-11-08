"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { formatDate } from "@/components/RaceGroups"
import { EnrollmentTag } from "@/components/EnrollmentTag"
import { DateOptionsEditor, type DateOptionDraft } from "@/components/DateOptionsEditor"
import { type DateOption, type DateVote, VOTE_MARKS, type Vote, compareOptions } from "@/lib/board"

const VOTES: Vote[] = ["ok", "maybe", "ng"]
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"]
const weekday = (date: string) => WEEKDAYS[new Date(`${date}T00:00:00`).getDay()]

// 日程調整の表（候補日 × 人の ○△×）。自分の行はボタンで付け外しする。
// 話題を立てた人・管理者は候補日の追加・削除と、候補日から練習予定を作れる
export function DatePoll({ threadId, threadTitle, options, votes, canVote, canEdit, decidedPracticeId, onChanged }: {
    threadId: number
    threadTitle: string
    options: DateOption[]
    votes: DateVote[]
    canVote: boolean
    canEdit: boolean
    decidedPracticeId: number | null
    onChanged: () => void
}) {
    const [adding, setAdding] = useState<DateOptionDraft[]>([])
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")

    const sorted = [...options].sort(compareOptions)
    // 人ごとの行（自分を先頭に、あとは名前順）
    const voters = new Map<string, { name: string; gender: string | null; enrollment: number | null; isMe: boolean; votes: Map<number, Vote> }>()
    for (const v of votes) {
        const row = voters.get(v.voter_key) ?? { name: v.voter_name ?? "（退会したメンバー）", gender: v.voter_gender, enrollment: v.voter_enrollment_year, isMe: v.is_me, votes: new Map() }
        row.votes.set(v.option_id, v.vote)
        voters.set(v.voter_key, row)
    }
    const rows = [...voters.entries()].sort(([, a], [, b]) => Number(b.isMe) - Number(a.isMe) || a.name.localeCompare(b.name))
    const myVotes = rows.find(([, r]) => r.isMe)?.[1].votes ?? new Map<number, Vote>()
    const count = (optionId: number, vote: Vote) => votes.filter(v => v.option_id === optionId && v.vote === vote).length
    // ○ が一番多い候補日（同数なら △ が多い方）
    const best = sorted.length > 0 ? Math.max(...sorted.map(o => count(o.id, "ok") * 1000 + count(o.id, "maybe"))) : 0

    const run = async (action: () => PromiseLike<{ error: { message: string } | null }>) => {
        setBusy(true)
        setError("")
        const { error } = await action()
        setBusy(false)
        if (error) { setError(`保存に失敗しました: ${error.message}`); return false }
        onChanged()
        return true
    }

    // 同じ印をもう一度押したら取り消す
    const vote = async (optionId: number, v: Vote) => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setError("ログインしてください"); return }
        await run(() => myVotes.get(optionId) === v
            ? supabase.from("thread_date_votes").delete().eq("option_id", optionId).eq("user_id", user.id)
            : supabase.from("thread_date_votes").upsert(
                { option_id: optionId, user_id: user.id, vote: v, updated_at: new Date().toISOString() },
                { onConflict: "option_id,user_id" },
            ))
    }

    const addOptions = async () => {
        const filled = adding.filter(o => o.date !== "")
        if (filled.length === 0) { setError("候補日を入力してください"); return }
        const ok = await run(() => createClient().from("thread_date_options")
            .insert(filled.map(o => ({ thread_id: threadId, option_date: o.date, label: o.label.trim() }))))
        if (ok) setAdding([])
    }

    const removeOption = async (o: DateOption) => {
        if (!confirm(`${formatDate(o.option_date)}${o.label && ` ${o.label}`} を候補から外しますか？ 付いている ○△× も消えます。`)) return
        await run(() => createClient().from("thread_date_options").delete().eq("id", o.id))
    }

    if (sorted.length === 0 && !canEdit) return null

    return (
        <div className="flex flex-col gap-2 text-sm">
            {decidedPracticeId != null && (
                <p className="bg-green-50 border border-green-300 rounded p-2">
                    日程が決まりました → <Link href={`/practices/${decidedPracticeId}`} className="text-blue-600 hover:underline font-bold">練習予定を見る</Link>
                </p>
            )}
            {sorted.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="border-collapse bg-white whitespace-nowrap">
                        <thead>
                            <tr className="border-b">
                                <th className="px-2 py-1 text-left">候補日</th>
                                <th className="px-2 py-1">○</th>
                                <th className="px-2 py-1">△</th>
                                <th className="px-2 py-1">×</th>
                                {rows.map(([key, r]) => (
                                    <th key={key} className={`px-2 py-1 font-normal ${r.gender === "female" ? "text-red-600" : ""}`}>
                                        {r.isMe ? "あなた" : r.name}{!r.isMe && <EnrollmentTag year={r.enrollment} />}
                                    </th>
                                ))}
                                {canVote && !rows.some(([, r]) => r.isMe) && <th className="px-2 py-1 font-normal">あなた</th>}
                                {canEdit && <th className="px-2 py-1"></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {sorted.map(o => {
                                const isBest = best > 0 && count(o.id, "ok") * 1000 + count(o.id, "maybe") === best
                                return (
                                    <tr key={o.id} className={isBest ? "bg-yellow-50" : ""}>
                                        <td className="px-2 py-1 font-mono">
                                            {formatDate(o.option_date)}（{weekday(o.option_date)}）{o.label && <span className="font-sans text-gray-600"> {o.label}</span>}
                                        </td>
                                        <td className="px-2 py-1 text-center font-bold">{count(o.id, "ok")}</td>
                                        <td className="px-2 py-1 text-center">{count(o.id, "maybe")}</td>
                                        <td className="px-2 py-1 text-center">{count(o.id, "ng")}</td>
                                        {rows.map(([key, r]) => (
                                            <td key={key} className="px-2 py-1 text-center">
                                                {r.isMe && canVote ? <VoteButtons current={r.votes.get(o.id)} disabled={busy} onVote={v => vote(o.id, v)} /> : (r.votes.has(o.id) ? VOTE_MARKS[r.votes.get(o.id)!] : "")}
                                            </td>
                                        ))}
                                        {canVote && !rows.some(([, r]) => r.isMe) && (
                                            <td className="px-2 py-1 text-center"><VoteButtons current={undefined} disabled={busy} onVote={v => vote(o.id, v)} /></td>
                                        )}
                                        {canEdit && (
                                            <td className="px-2 py-1 text-xs">
                                                <Link
                                                    href={`/practices/new?date=${o.option_date}&title=${encodeURIComponent(threadTitle)}&thread=${threadId}`}
                                                    className="text-blue-600 hover:underline mr-3"
                                                >
                                                    この日で練習予定を作る
                                                </Link>
                                                <button onClick={() => removeOption(o)} disabled={busy} className="text-red-600 hover:underline">外す</button>
                                            </td>
                                        )}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            {canVote && sorted.length > 0 && <p className="text-xs text-gray-500">○△× を押して付けます。同じものをもう一度押すと取り消せます。黄色は ○ が一番多い日です。</p>}
            {canEdit && (
                <div className="flex flex-col gap-1">
                    <DateOptionsEditor options={adding} onChange={setAdding} />
                    {adding.length > 0 && (
                        <button onClick={addOptions} disabled={busy} className="self-start px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-xs">候補日を保存</button>
                    )}
                </div>
            )}
            {error && <p className="text-red-600">{error}</p>}
        </div>
    )
}

function VoteButtons({ current, disabled, onVote }: { current: Vote | undefined; disabled: boolean; onVote: (v: Vote) => void }) {
    return (
        <span className="inline-flex gap-0.5">
            {VOTES.map(v => (
                <button
                    key={v}
                    onClick={() => onVote(v)}
                    disabled={disabled}
                    aria-pressed={current === v}
                    aria-label={VOTE_MARKS[v]}
                    className={`w-7 h-7 rounded border text-sm disabled:opacity-50 ${current === v ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-gray-100"}`}
                >
                    {VOTE_MARKS[v]}
                </button>
            ))}
        </span>
    )
}
