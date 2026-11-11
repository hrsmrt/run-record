// 掲示板の型
import type { ThreadMessage } from "@/components/MessageThread"

export type BoardThread = {
    id: number
    title: string
    body: string | null
    author_name: string | null
    author_gender: string | null
    author_enrollment_year: number | null
    decided_practice_id: number | null
    created_at: string
    updated_at: string
    post_count: number
    has_poll: boolean
    last_activity_at: string
    is_mine: boolean
    can_edit: boolean
    // 最後の返信（先頭80文字）。返信がなければ null
    last_post_excerpt: string | null
    last_post_author_name: string | null
    last_post_author_enrollment_year: number | null
    last_post_at: string | null
    // ルート案の件数
    route_count: number
    // 結び付けた大会（開催回）。なければ null
    edition_id: number | null
    edition_event_id: number | null
    edition_event_name: string | null
    edition_held_on: string | null
}

// 一覧で取る列（本文は除く）
export const BOARD_THREAD_COLUMNS =
    "id, title, author_name, author_gender, author_enrollment_year, decided_practice_id, created_at, updated_at, post_count, has_poll, last_activity_at, is_mine, can_edit, last_post_excerpt, last_post_author_name, last_post_author_enrollment_year, last_post_at, route_count, edition_id, edition_event_id, edition_event_name, edition_held_on"

export type BoardPost = ThreadMessage & { thread_id: number }

export type DateOption = { id: number; thread_id: number; option_date: string; label: string }

export type Vote = "ok" | "maybe" | "ng"
export const VOTE_MARKS: Record<Vote, string> = { ok: "○", maybe: "△", ng: "×" }

export type DateVote = {
    option_id: number
    thread_id: number
    vote: Vote
    voter_key: string
    voter_name: string | null
    voter_gender: string | null
    voter_enrollment_year: number | null
    is_me: boolean
}

// 話題のルート案（public_thread_routes の行。route_line は地図を開いたときに取る）
export type ThreadRoute = {
    id: number
    thread_id: number
    name: string
    note: string | null
    distance_km: number | null
    elevation_gain_m: number | null
    author_name: string | null
    author_gender: string | null
    author_enrollment_year: number | null
    created_at: string
    is_mine: boolean
    can_edit: boolean
    can_delete: boolean
}
export const THREAD_ROUTE_COLUMNS =
    "id, thread_id, name, note, distance_km, elevation_gain_m, author_name, author_gender, author_enrollment_year, created_at, is_mine, can_edit, can_delete"
export const THREAD_ROUTE_NAME_MAX = 50
export const THREAD_ROUTE_NOTE_MAX = 500

export const compareOptions = (a: DateOption, b: DateOption) => a.option_date.localeCompare(b.option_date) || a.label.localeCompare(b.label)

export const BOARD_THREAD_TITLE_MAX = 100
export const BOARD_TEXT_MAX = 5000
