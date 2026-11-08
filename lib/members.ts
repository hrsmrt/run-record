// メンバーの並び順と検索（入学年度の新しい順 → ふりがな順。入学年度がない人は最後。検索は名前・ふりがな・入学年度で、ひらがな・カタカナを区別しない）

export type SortableMember = { name: string | null; name_kana?: string | null; enrollment_year: number | null }

// カタカナをひらがなに、空白を除き、英字を小文字にする
export const normalizeKana = (s: string) =>
    s.normalize("NFKC")
        .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
        .replace(/[\s　]/g, "")
        .toLowerCase()

// 並べるときの読み（ふりがながなければ名前）
const readingOf = (m: SortableMember) => normalizeKana(m.name_kana || m.name || "")

export const compareMembers = (a: SortableMember, b: SortableMember) =>
    (b.enrollment_year ?? 0) - (a.enrollment_year ?? 0)
    || readingOf(a).localeCompare(readingOf(b), "ja")

export const matchesMember = (m: SortableMember, query: string) => {
    const q = normalizeKana(query)
    if (q === "") return true
    return normalizeKana(m.name ?? "").includes(q)
        || normalizeKana(m.name_kana ?? "").includes(q)
        || String(m.enrollment_year ?? "").includes(q)
        // 「17」で 2017年度入学も探せるように
        || (m.enrollment_year != null && String(m.enrollment_year % 100).padStart(2, "0") === q)
}
