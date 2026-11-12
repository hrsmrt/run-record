// 記録の結果の種類（完走・記録なし・DNF・DQ・DNS）の表示と並べ替え
import { formatTime } from "@/lib/utils"

export type ResultStatus = "finished" | "no_time" | "dnf" | "dq" | "dns"

export const RESULT_STATUSES: ResultStatus[] = ["finished", "no_time", "dnf", "dq", "dns"]
export const RESULT_STATUS_LABELS: Record<ResultStatus, string> = {
    finished: "完走",
    no_time: "完走（記録なし）",
    dnf: "DNF（途中棄権）",
    dq: "DQ（失格）",
    dns: "DNS（出走せず）",
}

// タイムが必須か（完走だけ）・入れられるか（DNF は棄権した時点、DQ は失格前の公式タイムなど。記録なし・DNS は入れない）
export const timeRequired = (s: ResultStatus) => s === "finished"
export const timeAllowed = (s: ResultStatus) => s === "finished" || s === "dnf" || s === "dq"

type ResultLike = { status?: ResultStatus | null; time_ms: number | null; dnf_km?: number | string | null }

// 記録の欄に出す文字（完走はタイム、それ以外は "DNF 30km" など）
export function formatResult(r: ResultLike): string {
    const status = r.status ?? "finished"
    if (status === "finished") return r.time_ms != null ? formatTime(r.time_ms) : ""
    if (status === "no_time") return "記録なし"
    if (status === "dns") return "DNS"
    if (status === "dq") return "DQ"
    return r.dnf_km != null ? `DNF ${Number(r.dnf_km)}km` : "DNF"
}

export const isFinished = (r: { status?: ResultStatus | null }) => (r.status ?? "finished") === "finished"

// タイム順に並べるとき: 完走（速い順）→ DNF（遠くまで走った順）→ DQ → 記録なし → DNS
const STATUS_ORDER: Record<ResultStatus, number> = { finished: 0, dnf: 1, dq: 2, no_time: 3, dns: 4 }
export function compareResult(a: ResultLike, b: ResultLike): number {
    const sa = a.status ?? "finished", sb = b.status ?? "finished"
    if (sa !== sb) return STATUS_ORDER[sa] - STATUS_ORDER[sb]
    if (sa === "dnf") return Number(b.dnf_km ?? 0) - Number(a.dnf_km ?? 0)
    return (a.time_ms ?? Infinity) - (b.time_ms ?? Infinity)
}

// タイムの欄に書いた文字から結果を読む（一括登録・CSV 用）。
// "3:12:34" → 完走、"DNF" "DNF 30" "DNF 30km" → 途中棄権（km は任意）、"DNS"、"DQ"（DSQ も可）、"記録なし"（NT も可）。
// parseTime はタイムの読み方（画面ごとに受け付ける形が違うため渡す）。読めなければ null
export function parseResultText(text: string, parseTime: (s: string) => number | null): { status: ResultStatus; time_ms: number | null; dnf_km: number | null } | null {
    const t = text.trim().normalize("NFKC")
    const upper = t.toUpperCase()
    if (upper === "DNS") return { status: "dns", time_ms: null, dnf_km: null }
    if (upper === "DQ" || upper === "DSQ") return { status: "dq", time_ms: null, dnf_km: null }
    if (t === "記録なし" || upper === "NT") return { status: "no_time", time_ms: null, dnf_km: null }
    const dnf = upper.match(/^DNF\s*(\d+(?:\.\d+)?)?\s*(?:KM)?$/)
    if (dnf) return { status: "dnf", time_ms: null, dnf_km: dnf[1] ? Number(dnf[1]) : null }
    const ms = parseTime(t)
    return ms != null && ms > 0 ? { status: "finished", time_ms: ms, dnf_km: null } : null
}
