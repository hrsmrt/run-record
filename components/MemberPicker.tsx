"use client"

import { useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { parseEnrollmentYear } from "@/lib/enrollment"
import { EnrollmentTag } from "@/components/EnrollmentTag"
import type { DirectoryMember } from "@/lib/practices"
import { compareMembers, matchesMember } from "@/lib/members"

const memberLabel = (m: DirectoryMember) => m.name || "名前未設定"

// 参加メンバーを複数選ぶ。名前で絞り込み、一覧にいない人は「アカウントなし」として追加できる
export function MemberPicker({ members, selected, onChange, onAdded }: {
    members: DirectoryMember[]
    selected: Set<string>
    onChange: (next: Set<string>) => void
    // 追加した人を一覧に加えるため、親に知らせる
    onAdded: (member: DirectoryMember) => void
}) {
    const [query, setQuery] = useState("")
    const [newName, setNewName] = useState("")
    const [newGender, setNewGender] = useState("")
    const [newEnrollment, setNewEnrollment] = useState("")
    const [newKana, setNewKana] = useState("")
    const [adding, setAdding] = useState(false)
    const [error, setError] = useState("")

    // 入学年度の古い順 → ふりがな順。名前・ふりがな・入学年度で絞り込む（ひらがな・カタカナは区別しない）
    const sorted = useMemo(() => members.filter(m => matchesMember(m, query)).sort(compareMembers), [members, query])

    const toggle = (id: string) => {
        const next = new Set(selected)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        onChange(next)
    }

    const handleAdd = async () => {
        setError("")
        const name = newName.trim()
        if (!name) { setError("名前を入力してください"); return }
        if (!newGender) { setError("性別を選んでください"); return }
        const enrollmentYear = parseEnrollmentYear(newEnrollment)
        if (enrollmentYear === undefined) { setError("入学年度は西暦4桁（例: 2017）で入力してください"); return }
        if (members.some(m => m.name === name) && !confirm(`「${name}」は一覧にすでにいます。別人として追加しますか？`)) return
        setAdding(true)
        const { data, error } = await createClient().rpc("add_pending_member", { p_name: name, p_gender: newGender, p_enrollment_year: enrollmentYear, p_name_kana: newKana.trim() || null })
        setAdding(false)
        if (error) { setError(`追加に失敗しました: ${error.message}`); return }
        const member: DirectoryMember = { user_id: data as string, name, gender: newGender, enrollment_year: enrollmentYear, is_pending: true, is_me: false, name_kana: newKana.trim() || null }
        onAdded(member)
        onChange(new Set(selected).add(member.user_id))
        setNewName("")
        setNewGender("")
        setNewEnrollment("")
        setNewKana("")
    }

    const chosen = members.filter(m => selected.has(m.user_id))
    const inputClass = "border rounded px-2 py-1 bg-white"

    return (
        <div className="flex flex-col gap-2 text-sm">
            <div className="flex flex-wrap gap-1">
                {chosen.length === 0 && <span className="text-gray-500">まだ選ばれていません</span>}
                {chosen.map(m => (
                    <button
                        key={m.user_id}
                        type="button"
                        onClick={() => toggle(m.user_id)}
                        className="px-2 py-0.5 rounded-full border bg-blue-50 hover:bg-blue-100"
                        aria-label={`${memberLabel(m)}を外す`}
                    >
                        {memberLabel(m)}<EnrollmentTag year={m.enrollment_year} /> ×
                    </button>
                ))}
            </div>
            <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="名前・ふりがな・入学年度で絞り込み"
                className={`${inputClass} w-56`}
            />
            <div className="max-h-60 overflow-y-auto border rounded bg-white p-1 grid grid-cols-2 sm:grid-cols-3 gap-x-2">
                {sorted.map(m => (
                    <label key={m.user_id} className="flex items-center gap-1 px-1 py-0.5 hover:bg-gray-50">
                        <input type="checkbox" checked={selected.has(m.user_id)} onChange={() => toggle(m.user_id)} />
                        <span className={m.gender === "female" ? "text-red-600" : ""}>
                            {memberLabel(m)}{m.is_me && "（自分）"}
                        </span>
                        <EnrollmentTag year={m.enrollment_year} />
                    </label>
                ))}
                {sorted.length === 0 && <p className="col-span-full text-gray-500 p-1">該当する人がいません</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-gray-600">一覧にいない人を追加:</span>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="表示名" className={`${inputClass} w-32`} />
                <input value={newKana} onChange={e => setNewKana(e.target.value)} placeholder="ふりがな" className={`${inputClass} w-32`} />
                <select value={newGender} onChange={e => setNewGender(e.target.value)} className={inputClass} aria-label="性別">
                    <option value="">性別</option>
                    <option value="male">男性</option>
                    <option value="female">女性</option>
                </select>
                <input value={newEnrollment} onChange={e => setNewEnrollment(e.target.value)} placeholder="入学年度" inputMode="numeric" className={`${inputClass} w-24`} />
                <button type="button" onClick={handleAdd} disabled={adding} className="px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-50">
                    {adding ? "追加中..." : "追加"}
                </button>
            </div>
            {error && <p className="text-red-600">{error}</p>}
            <p className="text-xs text-gray-500">追加した人は「アカウントなし」のメンバーになり、記録の一括登録などでも選べるようになります。</p>
        </div>
    )
}
