"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { formatDate } from "@/components/RaceGroups"
import { PLAN_LABELS, type RacePlan, fetchMissingResultPlans } from "@/lib/race-plans"

// 「エントリー済み・参加予定」にしていた大会が終わったのに記録がないとき、記録の入力を案内する。
// 「出なかった」を押すと予定を消す（案内も出なくなる）
export function MissingResults() {
    const [plans, setPlans] = useState<RacePlan[]>([])
    const [error, setError] = useState("")

    const load = useCallback(async () => setPlans(await fetchMissingResultPlans(createClient())), [])
    useEffect(() => { load() }, [load])

    const notRun = async (p: RacePlan) => {
        if (!confirm(`${p.event_name}には出なかったことにして、予定を消しますか？`)) return
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { error } = await supabase.from("race_plans").delete().eq("event_edition_id", p.event_edition_id).eq("user_id", user.id)
        if (error) { setError(`消せませんでした: ${error.message}`); return }
        load()
    }

    if (plans.length === 0) return null
    return (
        <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2 text-sm flex flex-col gap-1">
            <p className="font-bold text-blue-800">大会の記録を入れましょう</p>
            <ul className="flex flex-col gap-1">
                {plans.map(p => (
                    <li key={p.event_edition_id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-mono">{formatDate(p.held_on!)}</span>
                        <Link href={`/event/${p.event_id}#edition-${p.event_edition_id}`} className="font-bold text-blue-600 hover:underline">{p.event_name}</Link>
                        <span className="text-xs text-gray-600">{PLAN_LABELS[p.status]}{p.race_name && `・${p.race_name}`}</span>
                        <Link href={p.race_id != null ? `/records/form?race=${p.race_id}` : "/records/form"} className="px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs">
                            記録を入れる
                        </Link>
                        <button onClick={() => notRun(p)} className="text-xs text-gray-600 hover:underline">出なかった</button>
                    </li>
                ))}
            </ul>
            {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
    )
}
