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
}

// 一覧で取る列（本文は除く）
export const BOARD_THREAD_COLUMNS =
    "id, title, author_name, author_gender, author_enrollment_year, decided_practice_id, created_at, updated_at, post_count, has_poll, last_activity_at, is_mine, can_edit, last_post_excerpt, last_post_author_name, last_post_author_enrollment_year, last_post_at"

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

export const compareOptions = (a: DateOption, b: DateOption) => a.option_date.localeCompare(b.option_date) || a.label.localeCompare(b.label)

export const BOARD_THREAD_TITLE_MAX = 100
export const BOARD_TEXT_MAX = 5000
