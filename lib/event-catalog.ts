// 大会一覧・開催日順・カレンダーで共通の読み込みと絞り込み
import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchAll } from "@/lib/fetch-all"
import { PREFECTURE_ORDER, prefOrder } from "@/lib/prefectures"
import { normalizeEventName } from "@/components/RacePicker"
import { normalizeKana } from "@/lib/members"
import { todayStr } from "@/lib/practices"
import type { EntryDifficulty, EntryMethod } from "@/lib/event-info"
import type { PlanStatus } from "@/lib/race-plans"

export type CatalogEventRow = {
    id: number
    name: string
    type: string
    prefecture: string | null
    entry_method: EntryMethod | null
    entry_difficulty: EntryDifficulty | null
}
// name: 当時の大会名（改名した大会の昔の回。NULL なら大会の名前と同じ）
export type CatalogEditionRow = { id: number; event_id: number; held_on: string | null; edition_number: number | null; name: string | null }
export type CatalogRaceRow = {
    id: number
    event_edition_id: number
    name: string
    distance_km: number
    entry_start_at: string | null
    entry_end_at: string | null
    jaaf_certified: boolean | null
}
type PlanRow = { event_edition_id: number; status: PlanStatus; recruiting: boolean; is_me: boolean }

export type EventCatalog = {
    events: CatalogEventRow[]
    editions: CatalogEditionRow[]
    races: CatalogRaceRow[]
    // 開催回ごとのメンバーの予定
    plans: Map<number, PlanRow[]>
    // メンバーの記録の件数（開催回ごと・大会ごと。非表示のメンバー・紐付けのない記録・DNS は数えない）
    editionResults: Map<number, number>
    eventResults: Map<number, number>
    // 自分の記録がある大会
    myEvents: Set<number>
    noteCounts: Map<number, number>
    // 大会ごとの旧称（開催回の当時の名前）
    aliases: Map<number, string[]>
}

export async function loadEventCatalog(supabase: SupabaseClient): Promise<EventCatalog> {
    const { data: { user } } = await supabase.auth.getUser()
    const [events, editions, races, plans, results, notes, mine] = await Promise.all([
        fetchAll<CatalogEventRow>((f, t) => supabase.from("events").select("id, name, type, prefecture, entry_method, entry_difficulty").order("id").range(f, t)),
        fetchAll<CatalogEditionRow>((f, t) => supabase.from("event_editions").select("id, event_id, held_on, edition_number, name").order("id").range(f, t)),
        fetchAll<CatalogRaceRow>((f, t) => supabase.from("races").select("id, event_edition_id, name, distance_km, entry_start_at, entry_end_at, jaaf_certified").order("id").range(f, t)),
        fetchAll<PlanRow>((f, t) => supabase.from("public_race_plans").select("event_edition_id, status, recruiting, is_me").order("event_edition_id").range(f, t)),
        fetchAll<{ event_id: number | null; race_id: number | null }>((f, t) => supabase.from("public_results").select("event_id, race_id").not("race_id", "is", null).neq("status", "dns").order("id").range(f, t)),
        fetchAll<{ event_id: number }>((f, t) => supabase.from("public_event_notes").select("event_id").order("id").range(f, t)),
        user
            ? fetchAll<{ race_id: number }>((f, t) => supabase.from("results").select("race_id").eq("user_id", user.id).not("race_id", "is", null).order("id").range(f, t))
            : Promise.resolve([]),
    ])
    const raceEdition = new Map(races.map(r => [r.id, r.event_edition_id]))
    const editionEvent = new Map(editions.map(e => [e.id, e.event_id]))
    const count = <K,>(keys: K[]) => {
        const m = new Map<K, number>()
        for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1)
        return m
    }
    const planMap = new Map<number, PlanRow[]>()
    for (const p of plans) planMap.set(p.event_edition_id, [...(planMap.get(p.event_edition_id) ?? []), p])
    return {
        events,
        editions,
        races: races.map(r => ({ ...r, distance_km: Number(r.distance_km) })),
        plans: planMap,
        editionResults: count(results.flatMap(r => r.race_id != null && raceEdition.has(r.race_id) ? [raceEdition.get(r.race_id)!] : [])),
        eventResults: count(results.flatMap(r => r.event_id != null ? [r.event_id] : [])),
        myEvents: new Set(mine.flatMap(r => {
            const ev = editionEvent.get(raceEdition.get(r.race_id) ?? -1)
            return ev != null ? [ev] : []
        })),
        noteCounts: count(notes.map(n => n.event_id)),
        aliases: editions.reduce((m, ed) => {
            if (ed.name && !(m.get(ed.event_id) ?? []).includes(ed.name)) m.set(ed.event_id, [...(m.get(ed.event_id) ?? []), ed.name])
            return m
        }, new Map<number, string[]>()),
    }
}

// ---------------------------------------------------------------------
// 分類
// ---------------------------------------------------------------------
export type DistanceBucket = "short" | "half" | "30k" | "full" | "ultra"
export const DISTANCE_BUCKETS: DistanceBucket[] = ["short", "half", "30k", "full", "ultra"]
export const DISTANCE_BUCKET_LABELS: Record<DistanceBucket, string> = {
    short: "10km以下", half: "ハーフ", "30k": "30km前後", full: "フル", ultra: "ウルトラ",
}
export const distanceBucket = (km: number): DistanceBucket =>
    km <= 10.5 ? "short" : km <= 25 ? "half" : km < 40 ? "30k" : km <= 43 ? "full" : "ultra"

export const REGIONS = ["北海道・東北", "関東", "中部", "近畿", "中国", "四国", "九州・沖縄"] as const
// 都道府県コード順の区切り（その地方の最初の都道府県の番号）
const REGION_STARTS = [0, 7, 14, 23, 30, 35, 39]
export function regionOf(prefecture: string | null): string | null {
    const i = prefOrder(prefecture)
    if (i >= PREFECTURE_ORDER.length) return null
    let r = 0
    for (let k = 0; k < REGION_STARTS.length; k++) if (i >= REGION_STARTS[k]) r = k
    return REGIONS[r]
}
export const prefecturesOf = (region: string) => {
    const r = REGIONS.indexOf(region as typeof REGIONS[number])
    if (r < 0) return []
    return PREFECTURE_ORDER.slice(REGION_STARTS[r], REGION_STARTS[r + 1] ?? PREFECTURE_ORDER.length)
}
// 表記ゆれ（「東京」「東京都」）をそろえて比べる
export const samePrefecture = (a: string | null, b: string) => prefOrder(a) === prefOrder(b)

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"]
export const weekdayOf = (date: string) => WEEKDAYS[new Date(`${date}T00:00:00`).getDay()]
export const formatYmd = (d: string) => `${d.substring(0, 4)}/${d.substring(5, 7)}/${d.substring(8, 10)}`

// エントリーの状況（その開催回の種目のどれかが受付中なら受付中。締切は一番遅いもの）
export type EntryState = { kind: "open"; endAt: string | null } | { kind: "soon"; startAt: string } | null
export function entryStateOf(races: CatalogRaceRow[], now = Date.now()): EntryState {
    const open = races.filter(r => (r.entry_start_at == null || new Date(r.entry_start_at).getTime() <= now)
        && r.entry_end_at != null && new Date(r.entry_end_at).getTime() >= now)
    if (open.length > 0) return { kind: "open", endAt: open.map(r => r.entry_end_at!).sort().at(-1)! }
    const starts = races.map(r => r.entry_start_at).filter((s): s is string => !!s && new Date(s).getTime() > now).sort()
    if (starts.length > 0) return { kind: "soon", startAt: starts[0] }
    return null
}

const pad2 = (n: number) => String(n).padStart(2, "0")

// その年・月の第 n の weekday 曜日（第5がない月は最後のもの）
function nthWeekdayOf(y: number, m: number, weekday: number, n: number) {
    let d = 1 + (weekday - new Date(y, m - 1, 1).getDay() + 7) % 7 + (n - 1) * 7
    const last = new Date(y, m, 0).getDate()
    while (d > last) d -= 7
    return `${y}-${pad2(m)}-${pad2(d)}`
}

// 次の開催日（今日以降の登録済みの開催回。なければ前回と同じ月の同じ第◯◯曜日の推定日）。
// 前回がどれだけ古くても推定する（52週ずつ進めると1年に1〜2日ずつ早まるため、月と第◯◯曜日でそろえる）。
// from は推定のもとにした前回の開催日。開催日の入った回が1つもなければ null
export function nextDateOf(editions: CatalogEditionRow[], today = todayStr()): { date: string; estimated: boolean; editionId: number | null; from?: string } | null {
    const dated = editions.filter(e => e.held_on).sort((a, b) => a.held_on!.localeCompare(b.held_on!))
    const upcoming = dated.find(e => e.held_on! >= today)
    if (upcoming) return { date: upcoming.held_on!, estimated: false, editionId: upcoming.id }
    const latest = dated.at(-1)
    if (!latest) return null
    const from = latest.held_on!
    const base = new Date(`${from}T00:00:00`)
    const [month, weekday, n] = [base.getMonth() + 1, base.getDay(), Math.ceil(base.getDate() / 7)]
    let y = base.getFullYear() + 1
    let date = nthWeekdayOf(y, month, weekday, n)
    while (date < today) date = nthWeekdayOf(++y, month, weekday, n)
    return { date, estimated: true, editionId: null, from }
}

// ---------------------------------------------------------------------
// 絞り込み（URL の値）
// ---------------------------------------------------------------------
export type EventFilter = {
    q: string
    region: string
    pref: string
    type: string
    dist: string          // DistanceBucket
    mf: string            // 月（から）1〜12
    mt: string            // 月（まで）1〜12。mf より小さければ年をまたぐ（例: 11〜2月）
    method: string        // EntryMethod
    diff: string          // EntryDifficulty
    entry: string         // open（受付中）/ soon（これから受付）
    jaaf: string          // "1" なら陸連公認の種目がある
    member: string        // plans / recruit / ran / mine
}
export const FILTER_KEYS: (keyof EventFilter)[] = ["q", "region", "pref", "type", "dist", "mf", "mt", "method", "diff", "entry", "jaaf", "member"]
export const readFilter = (params: URLSearchParams): EventFilter =>
    Object.fromEntries(FILTER_KEYS.map(k => [k, params.get(k) ?? ""])) as EventFilter

export const MEMBER_FILTER_LABELS: Record<string, string> = {
    plans: "メンバーの予定がある",
    recruit: "参加者募集中",
    ran: "メンバーが出たことがある",
    mine: "自分が出たことがある",
}

const inMonths = (date: string, f: EventFilter) => {
    if (!f.mf && !f.mt) return true
    const m = Number(date.substring(5, 7))
    const from = Number(f.mf || 1), to = Number(f.mt || 12)
    return from <= to ? m >= from && m <= to : m >= from || m <= to
}

// 大会そのものの条件（名前・地域・種別・例年のエントリー・メンバーの出場）
function matchEventBase(c: EventCatalog, ev: CatalogEventRow, f: EventFilter) {
    if (f.q) {
        // 旧称（改名前の名前）でも見つかるようにする
        const q = normalizeKana(f.q.trim())
        const names = [ev.name, ...(c.aliases.get(ev.id) ?? [])]
        if (!names.some(n => normalizeKana(n).includes(q) || normalizeEventName(n).includes(normalizeEventName(f.q)))) return false
    }
    if (f.pref ? !samePrefecture(ev.prefecture, f.pref) : f.region && regionOf(ev.prefecture) !== f.region) return false
    if (f.type && ev.type !== f.type) return false
    if (f.method && ev.entry_method !== f.method) return false
    if (f.diff && ev.entry_difficulty !== f.diff) return false
    if (f.member === "ran" && !c.eventResults.get(ev.id)) return false
    if (f.member === "mine" && !c.myEvents.has(ev.id)) return false
    return true
}

// 種目の条件（距離・公認）
const matchRaces = (races: CatalogRaceRow[], f: EventFilter) =>
    (!f.dist || races.some(r => distanceBucket(r.distance_km) === f.dist))
    && (!f.jaaf || races.some(r => r.jaaf_certified))

// 予定・募集の条件
const matchPlans = (plans: PlanRow[] | undefined, f: EventFilter) =>
    f.member === "plans" ? (plans?.length ?? 0) > 0 : f.member === "recruit" ? !!plans?.some(p => p.recruiting) : true

// 開催回ごとの判定（開催日順・カレンダー）。種目が未登録の開催回は、同じ大会の他の回の種目で判定する
export function matchEdition(c: EventCatalog, ed: CatalogEditionRow, f: EventFilter) {
    const ev = c.events.find(e => e.id === ed.event_id)
    if (!ev || !matchEventBase(c, ev, f)) return false
    if (ed.held_on && !inMonths(ed.held_on, f)) return false
    if ((f.mf || f.mt) && !ed.held_on) return false
    const own = c.races.filter(r => r.event_edition_id === ed.id)
    const races = own.length > 0 ? own : racesOfEvent(c, ev.id)
    if (!matchRaces(races, f)) return false
    if (f.entry && entryStateOf(own)?.kind !== f.entry) return false
    return matchPlans(c.plans.get(ed.id), f)
}

export const racesOfEvent = (c: EventCatalog, eventId: number) => {
    const ids = new Set(c.editions.filter(e => e.event_id === eventId).map(e => e.id))
    return c.races.filter(r => ids.has(r.event_edition_id))
}

// 大会ごとの判定（大会一覧）。時期は次の開催日（推定を含む）、エントリー・予定はこれからの開催回で見る
export function matchEvent(c: EventCatalog, ev: CatalogEventRow, f: EventFilter, today = todayStr()) {
    if (!matchEventBase(c, ev, f)) return false
    if (!matchRaces(racesOfEvent(c, ev.id), f)) return false
    const eds = c.editions.filter(e => e.event_id === ev.id)
    if (f.mf || f.mt) {
        const next = nextDateOf(eds, today)
        if (!next || !inMonths(next.date, f)) return false
    }
    const upcoming = eds.filter(e => e.held_on && e.held_on >= today)
    if (f.entry && !upcoming.some(e => entryStateOf(c.races.filter(r => r.event_edition_id === e.id))?.kind === f.entry)) return false
    if ((f.member === "plans" || f.member === "recruit") && !upcoming.some(e => matchPlans(c.plans.get(e.id), f))) return false
    return true
}
