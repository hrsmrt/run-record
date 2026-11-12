// 大会の情報: 例年のエントリー方式・難易度と、大会ごとのメモの項目（1つのメモに複数付けられる）

export type EntryMethod = "first_come" | "lottery" | "mixed"
export type EntryDifficulty = "easy" | "normal" | "fast" | "instant"

export const ENTRY_METHODS: EntryMethod[] = ["first_come", "lottery", "mixed"]
export const ENTRY_METHOD_LABELS: Record<EntryMethod, string> = {
    first_come: "先着",
    lottery: "抽選",
    mixed: "先着と抽選（種目で違う）",
}

export const ENTRY_DIFFICULTIES: EntryDifficulty[] = ["easy", "normal", "fast", "instant"]
// 一覧の印に使う短い名前と、選ぶときの説明（先着なら定員に達するまで、抽選なら倍率の目安）
export const ENTRY_DIFFICULTY_LABELS: Record<EntryDifficulty, string> = {
    easy: "余裕あり",
    normal: "やや人気",
    fast: "人気",
    instant: "激戦",
}
export const ENTRY_DIFFICULTY_DESCRIPTIONS: Record<EntryDifficulty, string> = {
    easy: "余裕あり（締切まで空きがある／ほぼ当選）",
    normal: "やや人気（締切前に定員になる／当選しやすい）",
    fast: "人気（数日で定員になる／倍率2倍前後）",
    instant: "激戦（即日・数時間で定員になる／高倍率）",
}
export const ENTRY_DIFFICULTY_STYLES: Record<EntryDifficulty, string> = {
    easy: "bg-green-100 text-green-800",
    normal: "bg-yellow-100 text-yellow-800",
    fast: "bg-orange-100 text-orange-800",
    instant: "bg-red-100 text-red-800",
}

export type EventEntryInfo = { entry_method: EntryMethod | null; entry_difficulty: EntryDifficulty | null }

// 一覧に出す印の文字（"抽選・激戦" など。どちらも未設定なら null）
export function entryInfoLabel(info: EventEntryInfo | undefined): string | null {
    if (!info) return null
    const method = info.entry_method === "mixed" ? "先着・抽選" : info.entry_method ? ENTRY_METHOD_LABELS[info.entry_method] : null
    const difficulty = info.entry_difficulty ? ENTRY_DIFFICULTY_LABELS[info.entry_difficulty] : null
    const parts = [method, difficulty].filter(Boolean)
    return parts.length > 0 ? `例年 ${parts.join("・")}` : null
}

export type NoteCategory = "entry" | "access" | "raceday" | "course" | "prize" | "sightseeing" | "other"
export const NOTE_CATEGORIES: NoteCategory[] = ["entry", "access", "raceday", "course", "prize", "sightseeing", "other"]
export const NOTE_CATEGORY_LABELS: Record<NoteCategory, string> = {
    entry: "エントリー",
    access: "アクセス・宿",
    raceday: "スタート・当日の流れ",
    course: "コース",
    prize: "参加賞・景品",
    sightseeing: "観光・食事",
    other: "その他",
}
// 書くときの補足（選ぶ目安）
export const NOTE_CATEGORY_HINTS: Record<NoteCategory, string> = {
    entry: "締切までの早さ・倍率",
    access: "日帰りできるか・駐車場・宿",
    raceday: "受付・荷物・トイレ",
    course: "特徴・坂・景色",
    prize: "参加賞・完走賞・景品",
    sightseeing: "観光・温泉・食事",
    other: "",
}
export const NOTE_BODY_MAX = 2000

// public_event_notes の行
export type EventNote = {
    id: number
    event_id: number
    edition_id: number | null
    edition_held_on: string | null
    categories: NoteCategory[]
    body: string
    author_name: string | null
    author_gender: string | null
    author_enrollment_year: number | null
    created_at: string
    updated_at: string
    is_mine: boolean
    can_edit: boolean
}
