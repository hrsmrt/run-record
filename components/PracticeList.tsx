"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { VIEWER_ROLE } from "@/lib/viewer"
import { fetchAll } from "@/lib/fetch-all"
import { formatDate, fiscalYearOf } from "@/components/RaceGroups"
import { PRACTICE_LIST_COLUMNS, type Practice, type PracticeParticipant, compareParticipants, formatKm, practiceTitle } from "@/lib/practices"

// 練習録の一覧（新しい順）。年度・参加メンバー名で絞り込む
export function PracticeList() {
    const [practices, setPractices] = useState<Practice[] | null>(null)
    const [names, setNames] = useState<Map<number, PracticeParticipant[]>>(new Map())
    const [canCreate, setCanCreate] = useState(false)
    const [error, setError] = useState("")
    const [year, setYear] = useState("")
    const [nameQuery, setNameQuery] = useState("")

    useEffect(() => {
        const load = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            setCanCreate(!!user && user.app_metadata?.role !== VIEWER_ROLE)
            const [prs, pps] = await Promise.all([
                fetchAll<Practice>((from, to) => supabase.from("public_practices").select(PRACTICE_LIST_COLUMNS)
                    .order("held_on", { ascending: false }).order("id", { ascending: false }).range(from, to)),
                fetchAll<PracticeParticipant>((from, to) => supabase.from("public_practice_participants").select("*")
                    .order("practice_id").range(from, to)),
            ])
            const byPractice = new Map<number, PracticeParticipant[]>()
            for (const p of pps) byPractice.set(p.practice_id, [...(byPractice.get(p.practice_id) ?? []), p])
            byPractice.forEach(list => list.sort(compareParticipants))
            setNames(byPractice)
            setPractices(prs)
        }
        load().catch((e: Error) => setError(e.message))
    }, [])

    const years = useMemo(
        () => [...new Set((practices ?? []).map(p => fiscalYearOf(p.held_on)))].sort((a, b) => b - a),
        [practices],
    )

    const shown = useMemo(() => (practices ?? []).filter(p =>
        (year === "" || fiscalYearOf(p.held_on) === Number(year))
        && (nameQuery === "" || (names.get(p.id) ?? []).some(n => (n.name ?? "").includes(nameQuery)))),
    [practices, names, year, nameQuery])

    if (error) return <p className="text-sm text-red-600">読み込みに失敗しました: {error}</p>
    if (!practices) return <p className="text-sm">読み込み中...</p>

    const inputClass = "border rounded px-2 py-1 bg-white text-sm"

    return (
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-3 text-black">
            <div className="flex flex-wrap items-center gap-2">
                <select value={year} onChange={e => setYear(e.target.value)} className={inputClass} aria-label="年度">
                    <option value="">すべての年度</option>
                    {years.map(y => <option key={y} value={y}>{y}年度</option>)}
                </select>
                <input value={nameQuery} onChange={e => setNameQuery(e.target.value)} placeholder="参加メンバー名で検索" className={`${inputClass} w-44`} />
                <span className="text-sm text-gray-500">{shown.length}件</span>
                {canCreate && (
                    <Link href="/practices/new" className="ml-auto px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                        練習録を追加
                    </Link>
                )}
            </div>
            {shown.length === 0 && <p className="text-sm">{practices.length === 0 ? "まだ練習録はありません。" : "条件に合う練習録はありません。"}</p>}
            <ul className="flex flex-col gap-1">
                {shown.map(p => {
                    const list = names.get(p.id) ?? []
                    return (
                        <li key={p.id} className="bg-white px-2 py-1.5 text-sm flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                            <span className="font-mono text-gray-600">{formatDate(p.held_on)}</span>
                            <Link href={`/practices/${p.id}`} className="font-bold text-blue-600 hover:underline">{practiceTitle(p)}</Link>
                            {p.distance_km != null && <span className="text-xs text-gray-500">{formatKm(p.distance_km)}</span>}
                            {p.has_route && <span className="text-xs px-1 rounded bg-green-50 text-green-700">ルート</span>}
                            <span className="text-xs text-gray-600">
                                {list.length}人: {list.map(n => n.name ?? "名前未設定").join("、")}
                            </span>
                            {p.comment_count > 0 && <span className="text-xs text-gray-500">コメント{p.comment_count}件</span>}
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}
