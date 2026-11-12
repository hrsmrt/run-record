"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { fetchAll } from "@/lib/fetch-all"
import { type ResultStatus, formatResult } from "@/lib/result-status"
import { formatDistance } from "@/lib/splits"
import { RacePicker, normalizeEventName, useCatalog } from "@/components/RacePicker"
import type { RaceOption } from "@/components/RaceInput"

type UnlinkedResult = { id: number; user_id: string; race_name: string; date: string; distance: number; race_type: string | null; time_ms: number | null; status: ResultStatus; dnf_km: number | null }
type Member = { user_id: string; name: string | null; pending_auth: boolean }

// 大会名（表記ゆれを無視）・日付・距離が同じ記録のまとまり
type Group = { key: string; names: string[]; date: string; distance: number; results: UnlinkedResult[] }

// 候補にする距離の差（km）。GPS の値や「ハーフ 21.1」などの丸めの違いを許す
const DISTANCE_TOLERANCE_KM = 0.5

const formatDate = (d: string | null) => d ? `${d.substring(0, 4)}/${d.substring(5, 7)}/${d.substring(8, 10)}` : "開催日未定"

// 管理者: 大会情報に紐付いていない記録を、同じ大会ごとにまとめて紐付ける。
// 大会・開催日・種目がなければその場で追加できる（RacePicker）
export function UnlinkedResultsClient() {
    const catalog = useCatalog()
    const [results, setResults] = useState<UnlinkedResult[] | null>(null)
    const [members, setMembers] = useState<Map<string, Member>>(new Map())
    const [error, setError] = useState("")

    const load = useCallback(async () => {
        const supabase = createClient()
        try {
            const [rows, { data: memberData, error: memberError }] = await Promise.all([
                fetchAll<UnlinkedResult>((from, to) => supabase.from("results")
                    .select("id, user_id, race_name, date, distance, race_type, time_ms, status, dnf_km").is("race_id", null).order("id").range(from, to)),
                supabase.from("admin_members").select("user_id, name, pending_auth"),
            ])
            if (memberError) throw new Error(memberError.message)
            setResults(rows.map(r => ({ ...r, distance: Number(r.distance) })))
            setMembers(new Map(((memberData ?? []) as Member[]).map(m => [m.user_id, m])))
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
        }
    }, [])

    useEffect(() => { load() }, [load])

    // 件数の多い順、同じ件数なら日付の新しい順
    const groups = useMemo(() => {
        const m = new Map<string, Group>()
        for (const r of results ?? []) {
            const key = `${normalizeEventName(r.race_name)}|${r.date}|${r.distance}`
            const g = m.get(key) ?? { key, names: [], date: r.date, distance: r.distance, results: [] }
            if (!g.names.includes(r.race_name)) g.names.push(r.race_name)
            g.results.push(r)
            m.set(key, g)
        }
        return [...m.values()].sort((a, b) => b.results.length - a.results.length || b.date.localeCompare(a.date))
    }, [results])

    if (error || catalog.error) return <p className="p-4 text-sm text-red-600">読み込みに失敗しました: {error || catalog.error}</p>
    if (!results || !catalog.events) return <p className="p-4 text-sm">読み込み中...</p>

    return (
        <div className="px-4 pb-8 flex flex-col gap-3 text-black max-w-5xl">
            <p className="text-sm">
                大会情報に紐付いていない記録が <strong>{results.length}件</strong>（{groups.length}大会分）あります。
                大会名（空白・第〇回・年の違いは無視）・日付・距離が同じものをまとめています。
            </p>
            <p className="text-xs text-gray-500">
                紐付けると、記録の大会名・日付・距離は大会情報の値になります。同じ人がその種目にすでに記録を持っているときは、その人の分は飛ばします。
            </p>
            {groups.length === 0 && <p className="text-sm">紐付けのない記録はありません。</p>}
            {groups.map(g => (
                <UnlinkedGroup key={g.key} group={g} members={members} catalog={catalog} onLinked={() => { load(); catalog.reload() }} />
            ))}
        </div>
    )
}

function UnlinkedGroup({ group, members, catalog, onLinked }: {
    group: Group
    members: Map<string, Member>
    catalog: ReturnType<typeof useCatalog>
    onLinked: () => void
}) {
    const [picking, setPicking] = useState(false)
    const [picked, setPicked] = useState<RaceOption | null>(null)
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

    // 候補: 同じ日の開催回で、大会名が似ていて、距離が近い種目
    const candidates = useMemo(() => {
        const names = group.names.map(normalizeEventName).filter(n => n.length > 0)
        return catalog.races.flatMap(r => {
            const ed = catalog.editions.find(e => e.id === r.event_edition_id)
            if (!ed || ed.held_on !== group.date || Math.abs(r.distance_km - group.distance) > DISTANCE_TOLERANCE_KM) return []
            const ev = catalog.events?.find(e => e.id === ed.event_id)
            if (!ev) return []
            // その回の当時の名前（改名前の回）でも比べる
            const evNames = [ev.name, ed.name].filter((x): x is string => !!x).map(normalizeEventName)
            if (!names.some(x => evNames.some(n => x.includes(n) || n.includes(x)))) return []
            const option: RaceOption = {
                id: r.id, editionId: ed.id, eventName: ed.name ?? ev.name, eventType: ev.type, heldOn: ed.held_on, distanceKm: r.distance_km,
                label: `${ed.name ?? ev.name} ${formatDate(ed.held_on)} ${r.name}`,
            }
            return [option]
        })
    }, [catalog, group])

    const nameOf = (userId: string) => {
        const m = members.get(userId)
        return `${m?.name ?? "名前未設定"}${m?.pending_auth ? "（アカウントなし）" : ""}`
    }

    // 1件ずつ更新する（同じ人・同じ種目の一意の制約に当たった人だけ飛ばすため）
    const link = async (race: RaceOption) => {
        const dateNote = race.heldOn && race.heldOn !== group.date ? `\n※ 記録の日付 ${formatDate(group.date)} が ${formatDate(race.heldOn)} に変わります。` : ""
        if (!confirm(`${group.results.length}件を「${race.label}」に紐付けますか？${dateNote}`)) return
        setBusy(true)
        setMessage(null)
        const supabase = createClient()
        const skipped: string[] = []
        const failed: string[] = []
        for (const r of group.results) {
            const { error } = await supabase.from("results").update({
                race_id: race.id, race_name: race.eventName, date: race.heldOn ?? r.date, distance: race.distanceKm,
            }).eq("id", r.id)
            if (error?.code === "23505") skipped.push(nameOf(r.user_id))
            else if (error) failed.push(`${nameOf(r.user_id)}: ${error.message}`)
        }
        setBusy(false)
        const linked = group.results.length - skipped.length - failed.length
        if (skipped.length === 0 && failed.length === 0) { onLinked(); return }
        setMessage({
            text: [
                `${linked}件を紐付けました。`,
                skipped.length > 0 && `この種目にすでに記録があるため飛ばした人: ${skipped.join("、")}`,
                failed.length > 0 && `失敗: ${failed.join(" / ")}`,
            ].filter(Boolean).join(" "),
            isError: true,
        })
        if (linked > 0) onLinked()
    }

    return (
        <section className="bg-white border rounded p-3 text-sm flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-bold">{group.names.join(" / ")}</span>
                <span className="font-mono">{formatDate(group.date)}</span>
                <span>{formatDistance(group.distance)}</span>
                <span className="text-xs text-gray-600">{group.results.length}件</span>
            </div>
            <p className="text-xs text-gray-700">
                {group.results.map((r, i) => (
                    <span key={r.id}>{i > 0 && "、"}{nameOf(r.user_id)} {formatResult(r)}</span>
                ))}
            </p>

            {candidates.length > 0 && (
                <div className="flex flex-col gap-1">
                    {candidates.map(c => (
                        <div key={c.id} className="flex flex-wrap items-center gap-2 bg-green-50 border border-green-200 rounded px-2 py-1">
                            <span className="text-xs text-green-800 font-bold">候補</span>
                            <span>{c.label}</span>
                            <button onClick={() => link(c)} disabled={busy} className="px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-xs">
                                {group.results.length}件を紐付ける
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {picking ? (
                <div className="flex flex-col gap-2 border-t pt-2">
                    <RacePicker value={picked?.id ?? null} onChange={setPicked} />
                    <div className="flex items-center gap-3">
                        <button onClick={() => picked && link(picked)} disabled={busy || !picked} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-xs">
                            {busy ? "紐付け中..." : `${group.results.length}件を紐付ける`}
                        </button>
                        <button onClick={() => { setPicking(false); setPicked(null) }} className="text-xs text-gray-600 hover:underline">やめる</button>
                    </div>
                </div>
            ) : (
                <button onClick={() => setPicking(true)} className="self-start text-xs text-blue-600 hover:underline">
                    {candidates.length > 0 ? "ほかの種目を選ぶ・追加する" : "大会を選ぶ・追加する"}
                </button>
            )}
            {message && <p className={`text-xs ${message.isError ? "text-red-600" : "text-green-700"}`}>{message.text}</p>}
        </section>
    )
}
