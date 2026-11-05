"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUnsavedWarning } from "@/lib/use-unsaved-warning"
import { enrollmentToStr, parseEnrollmentYear, yearsSinceEnrollment } from "@/lib/enrollment"

type Member = {
    user_id: string
    name: string | null
    display_name: string | null
    gender: string | null
    pending_auth: boolean
    enrollment_year: number | null
}

// 管理者がメンバー（アカウントの有無を問わず）の入学年度を入力・修正する。
// 一覧の取得・保存は所有者権限の関数（admin_list_members・admin_set_enrollment_year）で行い、
// 関数の中で2段階認証済みの管理者かを確かめる
export function EditMembersClient() {
    const [members, setMembers] = useState<Member[] | null>(null)
    // 変更中の入学年度（user_id → 入力欄の文字列）
    const [edits, setEdits] = useState<Map<string, string>>(new Map())
    const [query, setQuery] = useState("")
    const [onlyMissing, setOnlyMissing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

    useUnsavedWarning(edits.size > 0)

    useEffect(() => {
        createClient().rpc("admin_list_members").then(({ data, error }) => {
            if (error) { setMessage({ text: `メンバー一覧の読み込みに失敗しました: ${error.message}`, isError: true }); return }
            setMembers((data ?? []) as Member[])
        })
    }, [])

    const label = (m: Member) => m.display_name || m.name || "名前未設定"

    // 入学年度の新しい順（未登録は先頭）、同じ年度の中は名前順
    const shown = useMemo(() => (members ?? [])
        .filter(m => !onlyMissing || m.enrollment_year == null)
        .filter(m => query === "" || label(m).includes(query) || (m.name ?? "").includes(query))
        .sort((a, b) => (b.enrollment_year ?? 9999) - (a.enrollment_year ?? 9999) || label(a).localeCompare(label(b))),
    [members, onlyMissing, query])

    const setEdit = (m: Member, value: string) => setEdits(prev => {
        const next = new Map(prev)
        if (value === enrollmentToStr(m.enrollment_year)) next.delete(m.user_id)
        else next.set(m.user_id, value)
        return next
    })

    const handleSave = async () => {
        if (!members) return
        const changes = members.flatMap(m => edits.has(m.user_id) ? [{ m, year: parseEnrollmentYear(edits.get(m.user_id)!) }] : [])
        const invalid = changes.filter(c => c.year === undefined).map(c => label(c.m))
        if (invalid.length > 0) {
            setMessage({ text: `入学年度は西暦4桁（例: 2017）で入力してください: ${invalid.join("、")}`, isError: true })
            return
        }
        setSaving(true)
        const supabase = createClient()
        const failed: string[] = []
        const saved = new Map<string, number | null>()
        for (const { m, year } of changes) {
            const { error } = await supabase.rpc("admin_set_enrollment_year", { p_user_id: m.user_id, p_year: year })
            if (error) failed.push(`${label(m)}（${error.message}）`)
            else saved.set(m.user_id, year ?? null)
        }
        setSaving(false)
        setMembers(prev => (prev ?? []).map(m => saved.has(m.user_id) ? { ...m, enrollment_year: saved.get(m.user_id)! } : m))
        setEdits(prev => {
            const next = new Map(prev)
            saved.forEach((_, id) => next.delete(id))
            return next
        })
        setMessage(failed.length > 0
            ? { text: `保存に失敗しました: ${failed.join(" / ")}`, isError: true }
            : { text: `${saved.size}人の入学年度を保存しました`, isError: false })
    }

    if (!members) return <p className="px-4 text-sm">{message?.text ?? "読み込み中..."}</p>

    return (
        <div className="px-4 pb-8 max-w-3xl">
            <div className="flex flex-wrap items-center gap-3 mb-3 text-sm">
                <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="名前で検索"
                    className="w-40 border rounded px-2 py-1"
                />
                <label className="flex items-center gap-1">
                    <input type="checkbox" checked={onlyMissing} onChange={e => setOnlyMissing(e.target.checked)} />
                    入学年度が未登録の人のみ
                </label>
                <span className="text-gray-500">
                    {shown.length}人（未登録 {members.filter(m => m.enrollment_year == null).length}人）
                </span>
            </div>
            <table className="border-collapse text-sm bg-white">
                <thead>
                    <tr className="border-b text-left">
                        <th className="px-2 py-1">名前</th>
                        <th className="px-2 py-1">アカウント</th>
                        <th className="px-2 py-1">入学年度</th>
                        <th className="px-2 py-1">今年度</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {shown.map(m => {
                        const value = edits.get(m.user_id) ?? enrollmentToStr(m.enrollment_year)
                        const year = parseEnrollmentYear(value)
                        return (
                            <tr key={m.user_id} className={edits.has(m.user_id) ? "bg-yellow-50" : ""}>
                                <td className={`px-2 py-1 ${m.gender === "female" ? "text-red-600" : ""}`}>
                                    {label(m)}
                                    {m.name && m.display_name && m.name !== m.display_name && (
                                        <span className="ml-1 text-xs text-gray-500">（{m.name}）</span>
                                    )}
                                </td>
                                <td className="px-2 py-1 text-xs text-gray-600">{m.pending_auth ? "なし" : "あり"}</td>
                                <td className="px-2 py-1">
                                    <input
                                        value={value}
                                        onChange={e => setEdit(m, e.target.value.trim())}
                                        inputMode="numeric"
                                        placeholder="例: 2017"
                                        aria-label={`${label(m)}の入学年度`}
                                        className={`w-20 border rounded px-1 py-0.5 ${year === undefined ? "border-red-500" : ""}`}
                                    />
                                </td>
                                <td className="px-2 py-1 text-gray-600">{year != null ? `${yearsSinceEnrollment(year)}年目` : ""}</td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
            <div className="mt-3 flex items-center gap-3">
                <button
                    onClick={handleSave}
                    disabled={saving || edits.size === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                    {saving ? "保存中..." : `変更を保存${edits.size > 0 ? `（${edits.size}人）` : ""}`}
                </button>
            </div>
            {message && (
                <p className={`mt-3 text-sm ${message.isError ? "text-red-600" : "text-green-700"}`}>{message.text}</p>
            )}
            <p className="mt-6 text-xs text-gray-500">
                ※ 入学年度は全メンバー（閲覧用アカウントを含む）に「〜年目」として表示されます。生年は表示されません。
                アカウントのあるメンバーは、本人もプロフィールで入力できます。
            </p>
        </div>
    )
}
