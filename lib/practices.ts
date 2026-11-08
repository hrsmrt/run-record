// 練習録の型と書式
import type { RoutePoint } from "@/lib/gpx"

export type Practice = {
    id: number
    held_on: string
    title: string | null
    distance_km: number | null
    elevation_gain_m: number | null
    memo: string | null
    has_route: boolean
    organizer_name: string | null
    organizer_gender: string | null
    organizer_enrollment_year: number | null
    participant_count: number
    comment_count: number
    can_edit: boolean
    am_participant: boolean
    updated_at: string
    // 詳細ページのみ取得する（一覧では重いので取らない）
    route_line?: RoutePoint[] | null
    route_path?: string | null
    // 練習予定の項目
    start_time: string | null
    meeting_place: string | null
    rsvp_deadline: string | null
    rsvp_yes_count: number
    rsvp_maybe_count: number
    my_rsvp: RsvpStatus | null
    message_count: number
    last_activity_at: string | null
    // 練習録として登録済み（終わった練習）。false で今日以降なら予定
    is_recorded: boolean
    // ルート案（地図で描いたもの）。線と GPX の場所は詳細ページのみ取得する
    has_plan_route: boolean
    plan_distance_km: number | null
    plan_elevation_gain_m: number | null
    plan_route_line?: RoutePoint[] | null
    plan_route_path?: string | null
}

export type RsvpStatus = "yes" | "maybe" | "no"
export const RSVP_LABELS: Record<RsvpStatus, string> = { yes: "参加", maybe: "検討中", no: "不参加" }

export type PracticeRsvp = {
    practice_id: number
    name: string | null
    gender: string | null
    enrollment_year: number | null
    status: RsvpStatus
    note: string | null
    updated_at: string
    is_me: boolean
}

export type PracticeMessage = {
    id: number
    practice_id: number
    author_name: string | null
    author_gender: string | null
    author_enrollment_year: number | null
    body: string
    created_at: string
    updated_at: string
    is_mine: boolean
}

// 今日（ブラウザのタイムゾーン）を YYYY-MM-DD で
export const todayStr = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// 予定（記録済みでなく、日付が今日以降）。当日でも練習録として登録したら「これまでの練習」に出す
export const isUpcoming = (p: { held_on: string; is_recorded: boolean }) => !p.is_recorded && p.held_on >= todayStr()

// 集合時刻（HH:MM:SS）→ HH:MM
export const formatStartTime = (t: string | null) => t ? t.substring(0, 5) : ""

// 一覧で取る列（route_line は数百点あるので除く）
export const PRACTICE_LIST_COLUMNS =
    "id, held_on, title, distance_km, elevation_gain_m, memo, has_route, organizer_name, organizer_gender, organizer_enrollment_year, participant_count, comment_count, can_edit, am_participant, updated_at, start_time, meeting_place, rsvp_deadline, rsvp_yes_count, rsvp_maybe_count, my_rsvp, message_count, last_activity_at, is_recorded, has_plan_route, plan_distance_km, plan_elevation_gain_m"

export type PracticeParticipant = {
    practice_id: number
    name: string | null
    gender: string | null
    enrollment_year: number | null
    is_organizer: boolean
    is_me: boolean
}

export type PracticeComment = {
    id: number
    practice_id: number
    author_name: string | null
    author_gender: string | null
    author_enrollment_year: number | null
    body: string
    updated_at: string
    is_mine: boolean
}

// 参加メンバーを選ぶための一覧（member_directory の行）
export type DirectoryMember = {
    user_id: string
    name: string | null
    gender: string | null
    enrollment_year: number | null
    is_pending: boolean
    is_me: boolean
    name_kana: string | null
}

export const practiceTitle = (p: { title: string | null }) => p.title || "練習"

export const formatKm = (km: number | null) => km == null ? "" : `${Number(km).toLocaleString(undefined, { maximumFractionDigits: 2 })}km`

// 入力欄の文字列 → 距離。空欄は null、不正な値は undefined
export const parseKm = (str: string): number | null | undefined => {
    const s = str.trim()
    if (s === "") return null
    const n = Number(s)
    return Number.isFinite(n) && n > 0 && n < 10000 ? Math.round(n * 1000) / 1000 : undefined
}

// 参加メンバーの並び（主催者 → 入学年度の新しい順 → 名前順。入学年度がない人は最後）
export const compareParticipants = (a: PracticeParticipant, b: PracticeParticipant) =>
    Number(b.is_organizer) - Number(a.is_organizer)
    || (b.enrollment_year ?? 0) - (a.enrollment_year ?? 0)
    || (a.name ?? "").localeCompare(b.name ?? "", "ja")
