// 入学年度と「〜年目」（入学した年度を1年目とし、4月に1つ増える）

export const MIN_ENROLLMENT_YEAR = 1950

// 今日の年度（4月始まり）
export const currentFiscalYear = (today = new Date()) =>
    today.getMonth() + 1 >= 4 ? today.getFullYear() : today.getFullYear() - 1

// 何年目か（例: 2017年入学なら 2026年度は 10）
export const yearsSinceEnrollment = (enrollmentYear: number, today = new Date()) =>
    currentFiscalYear(today) - enrollmentYear + 1

// 入力欄の文字列 → 入学年度。空欄は null、不正な値は undefined
export const parseEnrollmentYear = (str: string): number | null | undefined => {
    const s = str.trim()
    if (s === "") return null
    if (!/^\d{4}$/.test(s)) return undefined
    const y = Number(s)
    return y >= MIN_ENROLLMENT_YEAR && y <= currentFiscalYear() + 1 ? y : undefined
}

export const enrollmentToStr = (y: number | null | undefined) => y == null ? "" : String(y)
