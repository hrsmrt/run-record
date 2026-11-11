// 個人の大会予定（エントリー済み・参加予定・検討中・気になる）と、一緒に出る人の募集

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
