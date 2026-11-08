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
}

// 一覧で取る列（route_line は数百点あるので除く）
export const PRACTICE_LIST_COLUMNS =
    "id, held_on, title, distance_km, elevation_gain_m, memo, has_route, organizer_name, organizer_gender, organizer_enrollment_year, participant_count, comment_count, can_edit, am_participant, updated_at"

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

// 参加メンバーの並び（主催者 → 入学年度の古い順 → 名前順）
export const compareParticipants = (a: PracticeParticipant, b: PracticeParticipant) =>
    Number(b.is_organizer) - Number(a.is_organizer)
    || (a.enrollment_year ?? 9999) - (b.enrollment_year ?? 9999)
    || (a.name ?? "").localeCompare(b.name ?? "")
