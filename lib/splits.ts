// ラップ（result_splits）の表示・入力で共通に使う関数

export const HALF_KM = 21.0975

export const isFull = (km: number) => Math.abs(km - 42.195) < 0.001

// "1:23:45" / "23:45" / "23:45.6" → ミリ秒。不正なら null
export const parseElapsed = (str: string): number | null => {
    const m = str.trim().match(/^(?:(\d{1,2}):)?(\d{1,2}):([0-5]\d)(?:\.(\d{1,2}))?$/)
    if (!m) return null
    const [, hh, mm, ss, cc] = m
    if (hh !== undefined && Number(mm) > 59) return null
    return (Number(hh ?? 0) * 3600 + Number(mm) * 60 + Number(ss)) * 1000 + (cc ? Number(cc.padEnd(2, "0")) * 10 : 0)
}

// ミリ秒 → "1:23:45" / "23:45"（1/100秒があれば ".67" を付ける）
export const formatElapsed = (ms: number) => {
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    const cc = Math.floor((ms % 1000) / 10)
    const base = h > 0
        ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
        : `${m}:${String(s).padStart(2, "0")}`
    return cc > 0 ? `${base}.${String(cc).padStart(2, "0")}` : base
}

export const formatPace = (msPerKm: number) => {
    const total = Math.round(msPerKm / 1000)
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}/km`
}

// 区間表示用の地点名
export const pointLabel = (km: number) =>
    km === 0 ? "スタート" : Math.abs(km - HALF_KM) < 0.001 ? "ハーフ" : `${km}km`

export const formatDistance = (km: number) =>
    isFull(km) ? "フル" : Math.abs(km - HALF_KM) < 0.001 ? "ハーフ" : `${km}km`

// rank は大会の通過順位（入力がなければ省略）
export type SplitPoint = { km: number; ms: number; rank?: number | null }

export type SplitLap = SplitPoint & {
    netMs: number | null    // 通過タイム − スタートのロス（スタート行は null）
    fromKm: number | null   // 区間の開始地点（スタート行は null）
    lapMs: number | null
    paceMsPerKm: number | null
}

// 通過地点を距離順に並べ、ネット・区間タイム・ペースを付ける
export const computeLaps = (points: SplitPoint[]): SplitLap[] => {
    const sorted = [...points].sort((a, b) => a.km - b.km)
    const startMs = sorted.find(p => p.km === 0)?.ms ?? null
    return sorted.map((p, i) => {
        if (p.km === 0) return { ...p, netMs: null, fromKm: null, lapMs: null, paceMsPerKm: null }
        const prev = i > 0 ? sorted[i - 1] : { km: 0, ms: 0 }
        const lapMs = p.ms - prev.ms
        const segKm = p.km - prev.km
        const valid = lapMs > 0 && segKm > 0
        return {
            ...p,
            netMs: startMs !== null && p.ms >= startMs ? p.ms - startMs : null,
            fromKm: valid ? prev.km : null,
            lapMs: valid ? lapMs : null,
            paceMsPerKm: valid ? lapMs / segKm : null,
        }
    })
}
