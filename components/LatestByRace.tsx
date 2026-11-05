"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { RaceGroup, RaceGroupRecords, RaceGroupTitle, fetchRaceGroups, fiscalYearOf, formatDate } from "@/components/RaceGroups"

const MIN_GROUPS = 20

// 最近の記録を大会（同じ大会・同じ日）ごとにまとめて表示。
// 今年度の大会と直近 MIN_GROUPS 大会のうち、大会数が多い方を表示する
export function LatestByRace() {
    const [groups, setGroups] = useState<RaceGroup[] | null>(null)
    const [rangeLabel, setRangeLabel] = useState("")
    const [error, setError] = useState("")

    useEffect(() => {
        fetchRaceGroups(createClient())
            .then(all => {
                const today = new Date()
                const fy = fiscalYearOf(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`)
                const thisYear = all.filter(g => fiscalYearOf(g.date) >= fy)
                if (thisYear.length >= MIN_GROUPS) {
                    setGroups(thisYear)
                    setRangeLabel(`${fy}年度の大会（${thisYear.length}大会）`)
                } else {
                    const recent = all.slice(0, MIN_GROUPS)
                    setGroups(recent)
                    setRangeLabel(`直近${recent.length}大会`)
                }
            })
            .catch((e: Error) => setError(e.message))
    }, [])

    if (error) return <p className="text-sm text-red-600">読み込みに失敗しました: {error}</p>
    if (!groups) return <p className="text-sm">読み込み中...</p>

    return (
        <div className="w-full max-w-4xl mx-auto flex flex-col gap-4 text-black">
            <p className="text-sm text-gray-500">{rangeLabel}</p>
            {groups.map(g => (
                <section key={g.key} className="bg-white p-2">
                    <h2 className="text-sm md:text-base font-bold mb-1">
                        <span className="mr-2">{formatDate(g.date)}</span>
                        <RaceGroupTitle group={g} />
                        <span className="ml-2 text-xs font-normal text-gray-500">{g.records.length}人</span>
                    </h2>
                    <RaceGroupRecords records={g.records} />
                </section>
            ))}
            <p className="text-sm text-center">
                それより前の大会は <Link href="/races" className="text-blue-600 hover:underline">出場大会記録</Link> から
            </p>
        </div>
    )
}
