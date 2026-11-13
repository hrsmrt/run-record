"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getAdminState } from "@/lib/admin"
import { type UsageKind, type UsageMap, deletable, fetchCatalogUsage, usageKey, usageText } from "@/lib/catalog-usage"
import { normalizeEventName } from "@/components/RacePicker"
import { formatDistance } from "@/lib/splits"

type PanelEdition = {
    id: number
    held_on: string | null
    edition_number: number | null
    races: { id: number; name: string; distance_km: number }[]
}

const formatDate = (d: string | null) => d ? `${d.substring(0, 4)}/${d.substring(5, 7)}/${d.substring(8, 10)}` : "開催日未定"

// 大会詳細の管理者メニュー（管理者で2段階認証済みのときだけ）。
// ID と付いているものの件数、似た名前の大会、管理画面（この大会に絞った状態）とまとめる画面への入口、何も付いていないものの削除
export function EventAdminPanel({ eventId, eventName, editions }: { eventId: number; eventName: string; editions: PanelEdition[] }) {
    const router = useRouter()
    const [active, setActive] = useState(false)
    const [usage, setUsage] = useState<UsageMap | null>(null)
    const [similar, setSimilar] = useState<{ id: number; name: string }[]>([])
    const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        const load = async () => {
            const supabase = createClient()
            const { adminActive } = await getAdminState(supabase)
            setActive(adminActive)
            if (!adminActive) return
            // 似た名前: 大会名か旧称（開催回の当時の名前）が、空白・第〇回・年・「大会」を除いて同じ大会
            const [usageMap, { data: evs }, { data: eds }] = await Promise.all([
                fetchCatalogUsage(supabase).catch((e: Error) => { setMessage({ text: `件数を取得できませんでした: ${e.message}`, isError: true }); return null }),
                supabase.from("events").select("id, name"),
                supabase.from("event_editions").select("event_id, name").not("name", "is", null),
            ])
            setUsage(usageMap)
            const key = normalizeEventName(eventName)
            const ids = new Set<number>()
            for (const e of evs ?? []) if (e.id !== eventId && normalizeEventName(e.name) === key) ids.add(e.id)
            for (const e of eds ?? []) if (e.event_id !== eventId && normalizeEventName(e.name!) === key) ids.add(e.event_id)
            setSimilar((evs ?? []).filter(e => ids.has(e.id)))
        }
        load()
    }, [eventId, eventName])

    const counts = (kind: UsageKind, id: number) => usage ? usageText(usage.get(usageKey(kind, id)), kind) : "…"
    const canDelete = (kind: UsageKind, id: number) => !!usage && deletable(usage.get(usageKey(kind, id)), kind)

    // 開催日が同じ開催回（重複の疑い）
    const duplicateDates = useMemo(() => {
        const seen = new Map<string, number>()
        for (const ed of editions) if (ed.held_on) seen.set(ed.held_on, (seen.get(ed.held_on) ?? 0) + 1)
        return new Set([...seen].filter(([, n]) => n > 1).map(([d]) => d))
    }, [editions])

    if (!active) return null

    const remove = async (kind: UsageKind, id: number, label: string) => {
        const u = usage?.get(usageKey(kind, id))
        // 一緒に消えるもの（DB の ON DELETE CASCADE）を先に伝える
        const cascade = kind === "event"
            ? (u?.notes ? `大会のメモ${u.notes}件も一緒に削除されます。\n` : "")
            : kind === "edition"
                ? [u?.races && `種目${u.races}件`, u?.plans && `メンバーの予定${u.plans}件`, u?.organizers && `記録係${u.organizers}件`].filter(Boolean).join("・")
                : (u?.plans ? `この種目を選んだ予定${u.plans}件は種目なしになります。\n` : "")
        const warning = kind === "edition" && cascade ? `${cascade}も一緒に削除されます。\n` : cascade
        if (!confirm(`${warning}「${label}」を削除します。元に戻せません。よろしいですか？`)) return
        setBusy(true)
        const table = kind === "event" ? "events" : kind === "edition" ? "event_editions" : "races"
        const { error } = await createClient().from(table).delete().eq("id", id)
        setBusy(false)
        if (error) { setMessage({ text: `削除できませんでした: ${error.message}`, isError: true }); return }
        if (kind === "event") router.push("/event")
        else window.location.reload()
    }

    const link = "text-blue-600 hover:underline"
    const danger = "text-red-600 hover:underline disabled:opacity-50"
    const mergeHref = (params: Record<string, number | string>) => `/event/edit-merge?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`

    return (
        <details className="bg-amber-50 border border-amber-300 rounded p-3 text-sm text-black">
            <summary className="cursor-pointer font-bold">
                管理者メニュー <span className="font-normal text-gray-600">（大会 ID {eventId}・{counts("event", eventId)}）</span>
            </summary>
            <div className="flex flex-col gap-3 mt-2">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <Link href={`/event/edit-events?event=${eventId}`} className={link}>大会を編集</Link>
                    <Link href={`/event/edit-editions?event=${eventId}`} className={link}>開催日を編集</Link>
                    <Link href={`/event/edit-races?event=${eventId}`} className={link}>種目を編集</Link>
                    <Link href={mergeHref({ kind: "event", from: eventId })} className={link}>別の大会にまとめる</Link>
                    {canDelete("event", eventId)
                        ? <button onClick={() => remove("event", eventId, eventName)} disabled={busy} className={danger}>大会を削除</button>
                        : <span className="text-xs text-gray-500">開催回があるため削除できません（重複なら「まとめる」）</span>}
                </div>

                {similar.length > 0 && (
                    <div>
                        <p className="font-bold">似た名前の大会</p>
                        <ul className="flex flex-col gap-0.5">
                            {similar.map(s => (
                                <li key={s.id} className="flex flex-wrap items-baseline gap-x-2">
                                    <Link href={`/event/${s.id}`} className={link}>{s.name}</Link>
                                    <span className="text-xs text-gray-600">ID {s.id}・{counts("event", s.id)}</span>
                                    <Link href={mergeHref({ kind: "event", from: eventId, into: s.id })} className={`${link} text-xs`}>まとめる</Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div>
                    <p className="font-bold">開催回と種目</p>
                    {editions.length === 0 && <p className="text-gray-500">開催回はありません。</p>}
                    <ul className="flex flex-col gap-1">
                        {editions.map(ed => {
                            const label = `${formatDate(ed.held_on)}${ed.edition_number != null ? ` 第${ed.edition_number}回` : ""}`
                            return (
                                <li key={ed.id}>
                                    <div className="flex flex-wrap items-baseline gap-x-2">
                                        <span className="font-mono">{label}</span>
                                        {ed.held_on && duplicateDates.has(ed.held_on) && <span className="text-xs px-1 rounded bg-red-100 text-red-800">同じ日の開催回あり</span>}
                                        <span className="text-xs text-gray-600">ID {ed.id}・{counts("edition", ed.id)}</span>
                                        <Link href={mergeHref({ kind: "edition", event: eventId, from: ed.id })} className={`${link} text-xs`}>まとめる</Link>
                                        {canDelete("edition", ed.id) && (
                                            <button onClick={() => remove("edition", ed.id, label)} disabled={busy} className={`${danger} text-xs`}>削除</button>
                                        )}
                                    </div>
                                    <ul className="pl-4">
                                        {ed.races.map(r => {
                                            const raceLabel = `${r.name}（${formatDistance(r.distance_km)}）`
                                            return (
                                                <li key={r.id} className="flex flex-wrap items-baseline gap-x-2">
                                                    <span>{raceLabel}</span>
                                                    <span className="text-xs text-gray-600">ID {r.id}・{counts("race", r.id)}</span>
                                                    <Link href={mergeHref({ kind: "race", event: eventId, edition: ed.id, from: r.id })} className={`${link} text-xs`}>まとめる</Link>
                                                    {canDelete("race", r.id) && (
                                                        <button onClick={() => remove("race", r.id, `${label} ${raceLabel}`)} disabled={busy} className={`${danger} text-xs`}>削除</button>
                                                    )}
                                                </li>
                                            )
                                        })}
                                    </ul>
                                </li>
                            )
                        })}
                    </ul>
                    <p className="text-xs text-gray-500 mt-1">
                        削除は記録・大会レポート・コースが付いていないものだけ出します（付いているものは DB の制約で消せません。重複なら「まとめる」で付け替えます）。
                    </p>
                </div>
                {message && <p className={message.isError ? "text-red-600" : "text-green-700"}>{message.text}</p>}
            </div>
        </details>
    )
}
