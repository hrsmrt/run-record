// 順位・人数の入力と表示

// 入力欄の文字列 → 順位・人数（空欄は null、正の整数以外は undefined = 不正）
export const parseCount = (str: string): number | null | undefined => {
    const s = str.trim()
    if (s === "") return null
    if (!/^\d+$/.test(s)) return undefined
    const n = Number(s)
    return n > 0 ? n : undefined
}

export const countToStr = (n: number | null | undefined) => n == null ? "" : String(n)

// "123位 / 5,000人"（人数が不明なら "123位"）
export const formatRank = (rank: number | null | undefined, total?: number | null) =>
    rank == null ? "" : total != null ? `${rank.toLocaleString()}位 / ${total.toLocaleString()}人` : `${rank.toLocaleString()}位`
