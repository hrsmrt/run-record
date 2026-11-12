import { DISTANCE_BUCKETS, DISTANCE_BUCKET_LABELS, type CatalogRaceRow, type EntryState, distanceBucket } from "@/lib/event-catalog"
import { PLAN_LABELS, PLAN_STYLES, type PlanStatus, entryDeadlineText } from "@/lib/race-plans"

// 大会一覧・開催日順・カレンダーの行で共通の小さな表示

// 種目の距離の区分（フル・ハーフ…）。同じ区分は1つにまとめる
export function DistanceChips({ races }: { races: CatalogRaceRow[] }) {
    const buckets = DISTANCE_BUCKETS.filter(b => races.some(r => distanceBucket(r.distance_km) === b))
    if (buckets.length === 0) return null
    return (
        <span className="inline-flex flex-wrap gap-0.5">
            {buckets.map(b => <span key={b} className="text-xs px-1 rounded bg-sky-50 text-sky-800 border border-sky-200">{DISTANCE_BUCKET_LABELS[b]}</span>)}
        </span>
    )
}

const formatMd = (iso: string) => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}` }

export function EntryStateText({ state }: { state: EntryState }) {
    if (!state) return null
    if (state.kind === "soon") return <span className="text-xs text-gray-700">エントリー開始 {formatMd(state.startAt)}</span>
    return <span className="text-xs font-bold text-red-600">受付中{state.endAt && `・${entryDeadlineText(state.endAt) ?? ""}`}</span>
}

type PlanLike = { status: PlanStatus; recruiting: boolean; is_me: boolean }

// メンバーの予定の人数・募集中・自分の状態
export function PlanSummary({ plans }: { plans: PlanLike[] | undefined }) {
    if (!plans || plans.length === 0) return null
    const mine = plans.find(p => p.is_me)
    const recruiting = plans.some(p => p.recruiting)
    return (
        <span className="inline-flex flex-wrap gap-1">
            {mine && <span className={`text-xs px-1 rounded border ${PLAN_STYLES[mine.status]}`}>{PLAN_LABELS[mine.status]}</span>}
            <span className={`text-xs px-1 rounded ${recruiting ? "bg-orange-100 text-orange-800" : "bg-gray-100 text-gray-700"}`}>
                {recruiting && "募集中・"}予定{plans.length}人
            </span>
        </span>
    )
}
