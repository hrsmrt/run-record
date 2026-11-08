// 新着の表示。最後に見た日時をこのブラウザに覚えておき、それより新しい動きがあれば「新着」とする。
// 端末ごとの記録（スマホと PC では別々）。保存できない環境（プライベートブラウズなど）では新着を出さない

const PREFIX = "rr-seen:"
// 初めて使ったときの日時。これより前の動きは新着にしない（初回にすべてが新着になるのを防ぐ）
const SINCE_KEY = `${PREFIX}since`

const read = (key: string): string | null => {
    try { return window.localStorage.getItem(key) } catch { return null }
}
const write = (key: string, value: string) => {
    try { window.localStorage.setItem(key, value) } catch { /* 保存できない環境では何もしない */ }
}

// 新着の基準になる日時（未設定なら今を基準として保存する）
function since(): string | null {
    const s = read(SINCE_KEY)
    if (s) return s
    const now = new Date().toISOString()
    write(SINCE_KEY, now)
    return read(SINCE_KEY)
}

// kind は "practice" や "thread"、id はその ID。lastActivityAt は ISO 形式の日時
export function isNew(kind: string, id: number, lastActivityAt: string | null | undefined): boolean {
    if (!lastActivityAt) return false
    const base = read(`${PREFIX}${kind}:${id}`) ?? since()
    if (!base) return false
    return new Date(lastActivityAt).getTime() > new Date(base).getTime()
}

// 詳細ページを開いたときに呼ぶ
export function markSeen(kind: string, id: number) {
    write(`${PREFIX}${kind}:${id}`, new Date().toISOString())
}
