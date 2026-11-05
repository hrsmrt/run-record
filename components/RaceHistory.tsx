"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { formatDistance } from "@/lib/splits"
import { RaceGroup, RaceGroupRecords, RaceGroupTitle, fetchRaceGroups, fiscalYearOf, formatDate } from "@/components/RaceGroups"

// 種目の絞り込み（public_results の category）
const CATEGORIES = [
    { value: "", label: "すべての種目" },
    { value: "full", label: "フル" },
    { value: "half", label: "ハーフ" },
    { value: "other", label: "その他" },
]

const matchCategory = (category: string, filter: string) =>
    filter === "" || (filter === "other" ? category !== "full" && category !== "half" : category === filter)

// 出場した大会を新しい順に一覧し、行を開くとその大会の記録を表示する。
// 絞り込みの条件は URL に残す（大会詳細から戻っても消えず、条件ごとリンクを共有できる）
export function RaceHistory() {
    const router = useRouter()
    const pathname = usePathname()
    const params = useSearchParams()
    const year = params.get("year") ?? ""
    const category = params.get("cat") ?? ""

    const [groups, setGroups] = useState<RaceGroup[] | null>(null)
    const [error, setError] = useState("")
    const [openKeys, setOpenKeys] = useState<Set<string>>(new Set())
    // 文字の検索欄は画面の状態で持ち、URL へは入力が止まってから反映する
    // （URL を1文字ごとに書き換えると、日本語の変換中の入力が乱れるため）
    const [raceQuery, setRaceQuery] = useState(params.get("q") ?? "")
    const [nameQuery, setNameQuery] = useState(params.get("name") ?? "")

    useEffect(() => {
        fetchRaceGroups(createClient()).then(setGroups).catch((e: Error) => setError(e.message))
    }, [])

    const setParams = useCallback((patch: Record<string, string>) => {
        const next = new URLSearchParams(window.location.search)
        for (const [key, value] of Object.entries(patch)) {
            if (value === "") next.delete(key)
            else next.set(key, value)
        }
        const qs = next.toString()
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }, [router, pathname])
    const setParam = (key: string, value: string) => setParams({ [key]: value })

    useEffect(() => {
        const timer = setTimeout(() => {
            const current = new URLSearchParams(window.location.search)
            if ((current.get("q") ?? "") !== raceQuery || (current.get("name") ?? "") !== nameQuery) {
                setParams({ q: raceQuery, name: nameQuery })
            }
        }, 400)
        return () => clearTimeout(timer)
    }, [raceQuery, nameQuery, setParams])

    const years = useMemo(
        () => [...new Set((groups ?? []).map(g => fiscalYearOf(g.date)))].sort((a, b) => b - a),
        [groups],
    )

    // 種目で記録を絞り、残った記録がある大会だけを表示する
    const shown = useMemo(() => (groups ?? []).flatMap(g => {
        if (year !== "" && fiscalYearOf(g.date) !== Number(year)) return []
        if (raceQuery !== "" && !g.raceName.includes(raceQuery)) return []
        if (nameQuery !== "" && !g.records.some(r => r.name.includes(nameQuery))) return []
        const records = g.records.filter(r => matchCategory(r.category, category))
        return records.length > 0 ? [{ ...g, records }] : []
    }), [groups, year, raceQuery, nameQuery, category])

    const toggle = (key: string) => setOpenKeys(prev => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
    })

    if (error) return <p className="text-sm text-red-600">読み込みに失敗しました: {error}</p>
    if (!groups) return <p className="text-sm">読み込み中...</p>

    const filtered = year !== "" || raceQuery !== "" || nameQuery !== "" || category !== ""
    const inputClass = "border rounded px-2 py-1 bg-white text-sm"

    return (
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-3 text-black">
            <div className="flex flex-wrap items-center gap-2">
                <select value={year} onChange={e => setParam("year", e.target.value)} className={inputClass} aria-label="年度">
                    <option value="">すべての年度</option>
                    {years.map(y => <option key={y} value={y}>{y}年度</option>)}
                </select>
                <input
                    value={raceQuery}
                    onChange={e => setRaceQuery(e.target.value)}
                    placeholder="大会名で検索"
                    className={`${inputClass} w-40`}
                />
                <input
                    value={nameQuery}
                    onChange={e => setNameQuery(e.target.value)}
                    placeholder="メンバー名で検索"
                    className={`${inputClass} w-40`}
                />
                <select value={category} onChange={e => setParam("cat", e.target.value)} className={inputClass} aria-label="種目">
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                {filtered && (
                    <button onClick={() => { setRaceQuery(""); setNameQuery(""); router.replace(pathname, { scroll: false }) }} className="text-sm text-blue-600 hover:underline">
                        条件をクリア
                    </button>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                <span>{shown.length}大会（{shown.reduce((n, g) => n + g.records.length, 0)}件）</span>
                {shown.length > 0 && (
                    <>
                        <button onClick={() => setOpenKeys(new Set(shown.map(g => g.key)))} className="text-blue-600 hover:underline">すべて開く</button>
                        <button onClick={() => setOpenKeys(new Set())} className="text-blue-600 hover:underline">すべて閉じる</button>
                    </>
                )}
            </div>

            {shown.length === 0 && <p className="text-sm">条件に合う大会はありません。</p>}
            <ul className="flex flex-col gap-1">
                {shown.map(g => {
                    const open = openKeys.has(g.key)
                    const distances = [...new Set(g.records.map(r => r.distance))].map(formatDistance)
                    const names = [...new Set(g.records.map(r => r.name))]
                    return (
                        <li key={g.key} className="bg-white">
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-2 py-1.5 text-sm">
                                <button
                                    onClick={() => toggle(g.key)}
                                    aria-expanded={open}
                                    className="font-mono text-gray-600 hover:text-black"
                                >
                                    <span className="inline-block w-4" aria-hidden="true">{open ? "▾" : "▸"}</span>
                                    {formatDate(g.date)}
                                </button>
                                <span className="font-bold"><RaceGroupTitle group={g} /></span>
                                <span className="text-xs text-gray-500">{distances.join("・")}</span>
                                <button onClick={() => toggle(g.key)} className="text-xs text-gray-600 hover:text-black text-left">
                                    {names.length}人: {names.join("、")}
                                </button>
                            </div>
                            {open && (
                                <div className="px-2 pb-2">
                                    <RaceGroupRecords records={g.records} />
                                </div>
                            )}
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}
