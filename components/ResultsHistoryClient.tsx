"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { formatTime } from "@/lib/utils"
import { RESULT_STATUS_LABELS, type ResultStatus, formatResult } from "@/lib/result-status"
import { formatDateTime } from "@/components/MessageThread"

type HistoryRow = {
    id: number
    result_id: number
    action: "insert" | "update" | "delete"
    changed_at: string
    changed_by_name: string | null
    member_name: string | null
    race_name: string | null
    race_date: string | null
    old_row: Record<string, unknown> | null
    new_row: Record<string, unknown> | null
}

const ACTION_LABELS = { insert: "登録", update: "修正", delete: "削除" }
const LIMIT = 200

// 変更を見る列と表示名（ID や作成日時などは出さない）
const FIELDS: { key: string; label: string; format?: (v: unknown) => string }[] = [
    { key: "status", label: "結果", format: v => v == null ? "" : RESULT_STATUS_LABELS[v as ResultStatus] ?? String(v) },
    { key: "time_ms", label: "タイム", format: v => v == null ? "" : formatTime(Number(v)) },
    { key: "dnf_km", label: "DNF の距離", format: v => v == null ? "" : `${Number(v)}km` },
    { key: "distance", label: "距離" },
    { key: "race_name", label: "大会名" },
    { key: "date", label: "日付" },
    { key: "clever_index", label: "クレバー指数" },
    { key: "overall_rank", label: "総合順位" },
    { key: "gender_rank", label: "男女別順位" },
    { key: "division", label: "部門" },
    { key: "division_rank", label: "部門順位" },
    { key: "comment", label: "備考" },
    { key: "user_id", label: "メンバー", format: () => "（変更あり）" },
]

const show = (f: (typeof FIELDS)[number], v: unknown) => v == null || v === "" ? "—" : f.format ? f.format(v) : String(v)

// 記録の変更履歴（新しい順に最大 LIMIT 件）。管理者（2段階認証済み）のみ読める
export function ResultsHistoryClient() {
    const [rows, setRows] = useState<HistoryRow[] | null>(null)
    const [error, setError] = useState("")

    useEffect(() => {
        createClient().from("admin_results_history").select("*").order("changed_at", { ascending: false }).limit(LIMIT)
            .then(({ data, error }) => {
                if (error) { setError(error.message); return }
                setRows((data ?? []) as HistoryRow[])
            })
    }, [])

    if (error) return <p className="px-4 text-sm text-red-600">読み込みに失敗しました: {error}</p>
    if (!rows) return <p className="px-4 text-sm">読み込み中...</p>

    return (
        <div className="px-4 pb-8 text-sm text-black">
            <p className="mb-2 text-xs text-gray-500">直近 {LIMIT} 件まで。誰が・いつ・どの記録を変えたかを表示します。</p>
            {rows.length === 0 && <p>まだ変更はありません。</p>}
            <div className="overflow-x-auto">
                <table className="border-collapse bg-white">
                    <thead>
                        <tr className="border-b text-left whitespace-nowrap">
                            <th className="px-2 py-1">日時</th>
                            <th className="px-2 py-1">変更した人</th>
                            <th className="px-2 py-1">操作</th>
                            <th className="px-2 py-1">メンバー</th>
                            <th className="px-2 py-1">大会</th>
                            <th className="px-2 py-1">内容</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 align-top">
                        {rows.map(r => {
                            const changes = r.action === "update"
                                ? FIELDS.filter(f => JSON.stringify(r.old_row?.[f.key]) !== JSON.stringify(r.new_row?.[f.key]))
                                : []
                            const row = r.new_row ?? r.old_row
                            return (
                                <tr key={r.id}>
                                    <td className="px-2 py-1 whitespace-nowrap font-mono">{formatDateTime(r.changed_at)}</td>
                                    <td className="px-2 py-1 whitespace-nowrap">{r.changed_by_name ?? "（不明）"}</td>
                                    <td className={`px-2 py-1 whitespace-nowrap ${r.action === "delete" ? "text-red-600" : ""}`}>{ACTION_LABELS[r.action]}</td>
                                    <td className="px-2 py-1 whitespace-nowrap">{r.member_name ?? "（不明）"}</td>
                                    <td className="px-2 py-1 whitespace-nowrap">{r.race_name} {r.race_date?.replaceAll("-", "/")}</td>
                                    <td className="px-2 py-1">
                                        {r.action === "update"
                                            ? (changes.length === 0 ? <span className="text-gray-500">（表示する項目の変更なし）</span> : changes.map(f => (
                                                <div key={f.key}>{f.label}: {show(f, r.old_row?.[f.key])} → {show(f, r.new_row?.[f.key])}</div>
                                            )))
                                            : <span>{formatResult({ status: (row?.status as ResultStatus | undefined) ?? "finished", time_ms: row?.time_ms == null ? null : Number(row.time_ms), dnf_km: row?.dnf_km as number | null })}{row?.comment ? `・${String(row.comment)}` : ""}</span>}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
