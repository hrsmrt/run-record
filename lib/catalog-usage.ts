// 管理者用: 大会・開催回・種目に付いているものの件数（admin_catalog_usage()、sql/2026-11-14_catalog_usage.sql）
import type { SupabaseClient } from "@supabase/supabase-js"

export type UsageKind = "event" | "edition" | "race"
export type Usage = {
    editions: number
    races: number
    results: number
    reports: number
    routes: number
    organizers: number
    plans: number
    notes: number
    threads: number
}
export type UsageMap = Map<string, Usage>

export const usageKey = (kind: UsageKind, id: number) => `${kind}:${id}`

export async function fetchCatalogUsage(supabase: SupabaseClient): Promise<UsageMap> {
    const { data, error } = await supabase.rpc("admin_catalog_usage")
    if (error) throw new Error(error.message)
    return new Map((data as ({ kind: UsageKind; id: number } & Usage)[]).map(({ kind, id, ...u }) => [usageKey(kind, id), u]))
}

const LABELS: [keyof Usage, string][] = [
    ["editions", "開催回"], ["races", "種目"], ["results", "記録"], ["reports", "レポート"], ["routes", "コース"],
    ["organizers", "記録係"], ["plans", "予定"], ["notes", "メモ"], ["threads", "話題"],
]

// 「記録8・開催回3・種目5」のように、0 でないものだけ（記録を先頭に）。何もなければ「何も付いていません」
export function usageText(u: Usage | undefined, kind: UsageKind): string {
    if (!u) return ""
    const order = LABELS.filter(([k]) => !(kind !== "event" && k === "editions") && !(kind === "race" && k === "races"))
    const parts = [...order.filter(([k]) => k === "results"), ...order.filter(([k]) => k !== "results")]
        .filter(([k]) => u[k] > 0).map(([k, l]) => `${l}${u[k]}`)
    return parts.length > 0 ? parts.join("・") : "何も付いていません"
}

// 削除できるか（記録・レポートが付いていると DB の制約で消せない。大会は開催回が残っていると消せない。
// コースは消すとファイルが残るので、先にコースを消してもらう）
export function deletable(u: Usage | undefined, kind: UsageKind): boolean {
    if (!u) return false
    if (kind === "event") return u.editions === 0
    if (kind === "edition") return u.results === 0 && u.reports === 0 && u.routes === 0
    return u.results === 0 && u.routes === 0
}

// 重複のうち残す方の目安（記録 → 開催回・種目が多い方）
export const usageWeight = (u: Usage | undefined) => u ? u.results * 1000 + u.reports * 100 + u.editions * 10 + u.races : 0
