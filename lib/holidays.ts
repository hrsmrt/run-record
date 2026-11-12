// 日本の祝日（カレンダーの印用）。祝日法の決まりを計算で出す（春分・秋分は近似式。2099年まで有効）
// 振替休日（日曜の祝日の次の平日）と国民の休日（祝日にはさまれた平日）も含める

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`

// その月の第 n 月曜日
const nthMonday = (y: number, m: number, n: number) => {
    const first = new Date(y, m - 1, 1).getDay()
    return 1 + ((8 - first) % 7) + (n - 1) * 7
}

const equinox = (y: number, base: number) => Math.floor(base + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4))

function baseHolidays(y: number): [string, string][] {
    const list: [string, string][] = [
        [iso(y, 1, 1), "元日"],
        [iso(y, 1, nthMonday(y, 1, 2)), "成人の日"],
        [iso(y, 2, 11), "建国記念の日"],
        [iso(y, 2, 23), "天皇誕生日"],
        [iso(y, 3, equinox(y, 20.8431)), "春分の日"],
        [iso(y, 4, 29), "昭和の日"],
        [iso(y, 5, 3), "憲法記念日"],
        [iso(y, 5, 4), "みどりの日"],
        [iso(y, 5, 5), "こどもの日"],
        [iso(y, 9, nthMonday(y, 9, 3)), "敬老の日"],
        [iso(y, 9, equinox(y, 23.2488)), "秋分の日"],
        [iso(y, 11, 3), "文化の日"],
        [iso(y, 11, 23), "勤労感謝の日"],
    ]
    // 東京オリンピックの年は海の日・スポーツの日・山の日が移った
    if (y === 2020) list.push([iso(y, 7, 23), "海の日"], [iso(y, 7, 24), "スポーツの日"], [iso(y, 8, 10), "山の日"])
    else if (y === 2021) list.push([iso(y, 7, 22), "海の日"], [iso(y, 7, 23), "スポーツの日"], [iso(y, 8, 8), "山の日"])
    else list.push([iso(y, 7, nthMonday(y, 7, 3)), "海の日"], [iso(y, 10, nthMonday(y, 10, 2)), "スポーツの日"], [iso(y, 8, 11), "山の日"])
    return list
}

const cache = new Map<number, Map<string, string>>()

// その年の祝日（"YYYY-MM-DD" → 名前）
export function holidaysOf(y: number): Map<string, string> {
    const hit = cache.get(y)
    if (hit) return hit
    const map = new Map(baseHolidays(y))
    const addDays = (date: string, n: number) => {
        const d = new Date(`${date}T00:00:00`)
        d.setDate(d.getDate() + n)
        return iso(d.getFullYear(), d.getMonth() + 1, d.getDate())
    }
    for (const [date] of [...map.entries()]) {
        // 振替休日: 日曜の祝日の後、最初の祝日でない日
        if (new Date(`${date}T00:00:00`).getDay() === 0) {
            let next = addDays(date, 1)
            while (map.has(next)) next = addDays(next, 1)
            map.set(next, "振替休日")
        }
    }
    for (const [date] of [...map.entries()]) {
        // 国民の休日: 前後が祝日の平日
        const mid = addDays(date, 1)
        if (!map.has(mid) && map.has(addDays(date, 2)) && new Date(`${mid}T00:00:00`).getDay() !== 0) map.set(mid, "国民の休日")
    }
    cache.set(y, map)
    return map
}

export const holidayName = (date: string) => holidaysOf(Number(date.substring(0, 4))).get(date) ?? null
