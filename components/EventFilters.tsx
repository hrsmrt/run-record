"use client"

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
    DISTANCE_BUCKETS, DISTANCE_BUCKET_LABELS, type EventCatalog, type EventFilter, FILTER_KEYS, MEMBER_FILTER_LABELS,
    REGIONS, prefecturesOf, readFilter, regionOf,
} from "@/lib/event-catalog"
import { ENTRY_DIFFICULTIES, ENTRY_DIFFICULTY_LABELS, ENTRY_METHODS, ENTRY_METHOD_LABELS } from "@/lib/event-info"
import { PREFECTURE_ORDER, prefOrder } from "@/lib/prefectures"

// 絞り込みの条件を URL に持つ（タブを切り替えても、大会詳細から戻っても残る）。
// 大会名の検索欄は画面の状態で持ち、入力が止まってから URL に反映する（日本語の変換中に乱れないように）
export function useEventFilters() {
    const router = useRouter()
    const pathname = usePathname()
    const params = useSearchParams()
    const filter = useMemo(() => readFilter(new URLSearchParams(params.toString())), [params])
    const [query, setQuery] = useState(filter.q)

    const setParams = useCallback((patch: Record<string, string>) => {
        const next = new URLSearchParams(window.location.search)
        for (const [key, value] of Object.entries(patch)) {
            if (value === "") next.delete(key)
            else next.set(key, value)
        }
        const qs = next.toString()
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }, [router, pathname])

    useEffect(() => {
        const timer = setTimeout(() => {
            if ((new URLSearchParams(window.location.search).get("q") ?? "") !== query) setParams({ q: query })
        }, 400)
        return () => clearTimeout(timer)
    }, [query, setParams])

    const clear = () => {
        setQuery("")
        setParams(Object.fromEntries(FILTER_KEYS.map(k => [k, ""])))
    }
    const active = FILTER_KEYS.some(k => filter[k] !== "")
    return { filter, params, setParams, query, setQuery, clear, active }
}

// 大会情報の入口（ヘッダーのメニュー）は開催日順
const TABS = [
    { href: "/event/editions", label: "開催日順" },
    { href: "/event", label: "大会" },
    { href: "/event/schedule", label: "カレンダー" },
]

// 3つの表示の切り替え。絞り込みの条件は引き継ぐ（それぞれの表示だけの条件は引き継がない）
export function EventTabs({ current, params }: { current: string; params: URLSearchParams }) {
    const shared = new URLSearchParams()
    for (const k of FILTER_KEYS) { const v = params.get(k); if (v) shared.set(k, v) }
    const qs = shared.toString()
    return (
        <nav className="flex gap-1 mb-3 text-sm border-b">
            {TABS.map(t => t.href === current ? (
                <span key={t.href} className="px-3 py-1 font-bold border-b-2 border-blue-600 -mb-px">{t.label}</span>
            ) : (
                <Link key={t.href} href={qs ? `${t.href}?${qs}` : t.href} className="px-3 py-1 text-blue-600 hover:bg-gray-50">{t.label}</Link>
            ))}
        </nav>
    )
}

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1))

// 共通の絞り込み欄。children にはその表示だけの項目（並び順など）を入れる
export function EventFilterBar({ catalog, filter, setParams, query, setQuery, clear, active, children }: {
    catalog: EventCatalog
    filter: EventFilter
    setParams: (patch: Record<string, string>) => void
    query: string
    setQuery: (q: string) => void
    clear: () => void
    active: boolean
    children?: ReactNode
}) {
    const [open, setOpen] = useState(false)
    const types = useMemo(() => [...new Set(catalog.events.map(e => e.type).filter(Boolean))].sort(), [catalog])
    // 大会がある地方・都道府県だけを選択肢にする
    const regions = useMemo(() => REGIONS.filter(r => catalog.events.some(e => regionOf(e.prefecture) === r)), [catalog])
    const prefs = useMemo(() => {
        const list = filter.region ? prefecturesOf(filter.region) : PREFECTURE_ORDER
        return list.filter(p => catalog.events.some(e => e.prefecture && prefOrder(e.prefecture) === prefOrder(p)))
    }, [catalog, filter.region])

    const select = (key: keyof EventFilter, options: [string, string][], placeholder: string, extra?: Record<string, string>) => (
        <select
            value={filter[key]}
            onChange={e => setParams({ [key]: e.target.value, ...extra })}
            className={`border rounded px-1 py-1 bg-white ${filter[key] ? "border-blue-500" : ""}`}
            aria-label={placeholder}
        >
            <option value="">{placeholder}</option>
            {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
    )
    // スマホでは、よく使う項目以外を「条件を増やす」にしまう
    const advancedCount = (["type", "mf", "mt", "method", "diff", "entry", "jaaf", "member"] as const).filter(k => filter[k] !== "").length

    return (
        <div className="flex flex-col gap-2 bg-white text-black border rounded p-2 mb-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
                <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="大会名で探す"
                    className="border rounded px-2 py-1 flex-1 min-w-[10rem]"
                    aria-label="大会名で探す"
                />
                {select("region", regions.map(r => [r, r]), "地方", { pref: "" })}
                {select("pref", prefs.map(p => [p, p]), "都道府県")}
                {select("dist", DISTANCE_BUCKETS.map(d => [d, DISTANCE_BUCKET_LABELS[d]]), "距離")}
                <button onClick={() => setOpen(o => !o)} className="text-blue-600 hover:underline md:hidden" aria-expanded={open}>
                    {open ? "閉じる" : `条件を増やす${advancedCount > 0 ? `（${advancedCount}）` : ""}`}
                </button>
            </div>
            <div className={`${open ? "flex" : "hidden"} md:flex flex-wrap items-center gap-2`}>
                {select("type", types.map(t => [t, t]), "種別")}
                <span className="flex items-center gap-1">
                    {select("mf", MONTHS.map(m => [m, `${m}月`]), "何月から")}
                    〜
                    {select("mt", MONTHS.map(m => [m, `${m}月`]), "何月まで")}
                </span>
                {select("method", ENTRY_METHODS.map(m => [m, `例年 ${ENTRY_METHOD_LABELS[m]}`]), "エントリー方式")}
                {select("diff", ENTRY_DIFFICULTIES.map(d => [d, `例年 ${ENTRY_DIFFICULTY_LABELS[d]}`]), "例年の難易度")}
                {select("entry", [["open", "今受付中"], ["soon", "これから受付開始"]], "エントリー状況")}
                {select("member", Object.entries(MEMBER_FILTER_LABELS), "メンバー")}
                <label className="flex items-center gap-1">
                    <input type="checkbox" checked={filter.jaaf === "1"} onChange={e => setParams({ jaaf: e.target.checked ? "1" : "" })} />
                    陸連公認
                </label>
            </div>
            {(children || active) && (
                <div className="flex flex-wrap items-center gap-3 border-t pt-2">
                    {children}
                    {active && <button onClick={clear} className="text-blue-600 hover:underline ml-auto">条件をすべて外す</button>}
                </div>
            )}
        </div>
    )
}
