// 個人の大会予定（エントリー済み・参加予定・検討中・気になる）と、一緒に出る人の募集
import type { SupabaseClient } from "@supabase/supabase-js"
import { todayStr } from "@/lib/practices"

export type PlanStatus = "entered" | "going" | "considering" | "interested"

export const PLAN_STATUSES: PlanStatus[] = ["entered", "going", "considering", "interested"]

export const PLAN_LABELS: Record<PlanStatus, string> = {
    entered: "エントリー済み",
    going: "参加予定",
    considering: "検討中",
    interested: "気になる",
}

// 押したボタン・名前の一覧の色
export const PLAN_STYLES: Record<PlanStatus, string> = {
    entered: "bg-blue-600 text-white border-blue-600",
    going: "bg-sky-500 text-white border-sky-500",
    considering: "bg-yellow-400 text-black border-yellow-400",
    interested: "bg-gray-500 text-white border-gray-500",
}

export const PLAN_NOTE_MAX = 200

// public_race_plans の行（user_id は出さない。is_me は閲覧中の本人か）
export type RacePlan = {
    event_edition_id: number
    event_id: number
    event_name: string
    held_on: string | null
    race_id: number | null
    race_name: string | null
    status: PlanStatus
    is_private: boolean
    recruiting: boolean
    note: string | null
    name: string | null
    gender: string | null
    enrollment_year: number | null
    updated_at: string
    is_me: boolean
}

// 気になる以外で、全員に見える予定だけ募集できる
export const canRecruit = (status: PlanStatus, isPrivate: boolean) => status !== "interested" && !isPrivate

// エントリー締切までの日数の表示（"締切まであと5日" / "今日締切" / 過ぎていれば null）
export function entryDeadlineText(entryEndAt: string | null, now = new Date()): string | null {
    if (!entryEndAt) return null
    const end = new Date(entryEndAt)
    if (end.getTime() < now.getTime()) return null
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const days = Math.round((startOfDay(end) - startOfDay(now)) / 86400000)
    return days === 0 ? "今日締切" : `締切まであと${days}日`
}

// エントリー期間の状況（自分の予定の一覧用）。start・end は TIMESTAMPTZ
export function entryStatusText(start: string | null, end: string | null, now = new Date()): { text: string; urgent: boolean } | null {
    const fmt = (iso: string) => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}` }
    if (start && new Date(start).getTime() > now.getTime()) return { text: `エントリー開始 ${fmt(start)}`, urgent: false }
    const deadline = entryDeadlineText(end, now)
    if (deadline) return { text: `受付中・${deadline}`, urgent: true }
    if (end) return { text: "エントリー締切済み", urgent: false }
    return null
}

// 記録の入力を案内する期間（開催日から何日まで）
const MISSING_RESULT_DAYS = 90

// 「エントリー済み・参加予定」にしていて開催日が過ぎたのに、自分の記録がまだない予定（開催日の新しい順）。
// 記録はその開催回の種目に紐付いたもの、または紐付けなしで日付が開催日と同じものがあれば入力済みとみなす
export async function fetchMissingResultPlans(supabase: SupabaseClient): Promise<RacePlan[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const from = new Date(Date.now() - MISSING_RESULT_DAYS * 86400000)
    const fromStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`
    const { data: planData } = await supabase.from("public_race_plans").select("*")
        .eq("is_me", true).in("status", ["entered", "going"]).lt("held_on", todayStr()).gte("held_on", fromStr)
        .order("held_on", { ascending: false })
    const plans = (planData ?? []) as RacePlan[]
    if (plans.length === 0) return []
    const [{ data: raceData }, { data: resultData }] = await Promise.all([
        supabase.from("races").select("id, event_edition_id").in("event_edition_id", plans.map(p => p.event_edition_id)),
        supabase.from("results").select("race_id, date").eq("user_id", user.id).gte("date", fromStr),
    ])
    const editionOfRace = new Map(((raceData ?? []) as { id: number; event_edition_id: number }[]).map(r => [r.id, r.event_edition_id]))
    const results = (resultData ?? []) as { race_id: number | null; date: string }[]
    return plans.filter(p => !results.some(r =>
        r.race_id != null ? editionOfRace.get(r.race_id) === p.event_edition_id : r.date === p.held_on))
}
