"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { countToStr, parseCount } from "@/lib/ranks"

type Division = { id: number; name: string; entrantsStr: string; dirty: boolean }

// 1つのレースの部門と部門ごとのエントリー数を編集する（管理者用、行ごとに保存）
export function RaceDivisionsEditor({ raceId }: { raceId: number }) {
    const [divisions, setDivisions] = useState<Division[] | null>(null)
    // メンバーが記録に入力した部門名のうち、まだ登録されていないもの
    const [unregistered, setUnregistered] = useState<string[]>([])
    const [newName, setNewName] = useState("")
    const [newEntrants, setNewEntrants] = useState("")
    const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

    useEffect(() => {
        const fetch = async () => {
            const supabase = createClient()
            const [{ data, error }, { data: used }] = await Promise.all([
                supabase.from("race_divisions").select("id, name, entrants").eq("race_id", raceId).order("name"),
                supabase.from("public_results").select("division").eq("race_id", raceId).not("division", "is", null),
            ])
            if (error) { setMessage({ text: `読み込みに失敗しました: ${error.message}`, isError: true }); return }
            const list = (data ?? []).map(d => ({ id: d.id, name: d.name, entrantsStr: countToStr(d.entrants), dirty: false }))
            setDivisions(list)
            const registered = new Set(list.map(d => d.name))
            setUnregistered([...new Set((used ?? []).map(u => u.division as string))].filter(n => !registered.has(n)).sort())
        }
        fetch()
    }, [raceId])

    const update = (id: number, patch: Partial<Division>) =>
        setDivisions(prev => prev?.map(d => d.id === id ? { ...d, ...patch, dirty: true } : d) ?? prev)

    const save = async (d: Division) => {
        const entrants = parseCount(d.entrantsStr)
        if (d.name.trim() === "") { setMessage({ text: "部門名を入力してください", isError: true }); return }
        if (entrants === undefined) { setMessage({ text: "エントリー数は正の整数で入力してください", isError: true }); return }
        const { error } = await createClient().from("race_divisions")
            .update({ name: d.name.trim(), entrants }).eq("id", d.id)
        if (error) { setMessage({ text: `保存に失敗しました: ${error.message}`, isError: true }); return }
        setDivisions(prev => prev?.map(x => x.id === d.id ? { ...x, name: d.name.trim(), dirty: false } : x) ?? prev)
        setMessage({ text: `「${d.name.trim()}」を保存しました`, isError: false })
    }

    const remove = async (d: Division) => {
        if (!confirm(`部門「${d.name}」を削除しますか？`)) return
        const { error } = await createClient().from("race_divisions").delete().eq("id", d.id)
        if (error) { setMessage({ text: `削除に失敗しました: ${error.message}`, isError: true }); return }
        setDivisions(prev => prev?.filter(x => x.id !== d.id) ?? prev)
        setMessage({ text: `「${d.name}」を削除しました`, isError: false })
    }

    const add = async () => {
        const name = newName
        const entrants = parseCount(newEntrants)
        if (name.trim() === "") { setMessage({ text: "部門名を入力してください", isError: true }); return }
        if (entrants === undefined) { setMessage({ text: "エントリー数は正の整数で入力してください", isError: true }); return }
        const { data, error } = await createClient().from("race_divisions")
            .insert({ race_id: raceId, name: name.trim(), entrants })
            .select("id, name, entrants").single()
        if (error) { setMessage({ text: `追加に失敗しました: ${error.message}`, isError: true }); return }
        setDivisions(prev => [...(prev ?? []), { id: data.id, name: data.name, entrantsStr: countToStr(data.entrants), dirty: false }])
        setUnregistered(prev => prev.filter(n => n !== data.name))
        setNewName("")
        setNewEntrants("")
        setMessage({ text: `「${data.name}」を追加しました`, isError: false })
    }

    if (!divisions) return <p className="text-xs text-gray-500">{message?.text ?? "読み込み中..."}</p>

    return (
        <div className="text-sm">
            <table className="border-collapse">
                <thead>
                    <tr className="border-b text-left text-xs text-gray-500">
                        <th className="px-2 py-0.5">部門名（大会の表記）</th>
                        <th className="px-2 py-0.5">エントリー数</th>
                        <th className="px-2 py-0.5"></th>
                    </tr>
                </thead>
                <tbody>
                    {divisions.map(d => (
                        <tr key={d.id} className={d.dirty ? "bg-yellow-50" : ""}>
                            <td className="px-2 py-0.5">
                                <input className="w-40 px-1 border rounded" value={d.name}
                                    onChange={e => update(d.id, { name: e.target.value })} />
                            </td>
                            <td className="px-2 py-0.5">
                                <input className="w-24 px-1 border rounded" inputMode="numeric" value={d.entrantsStr}
                                    onChange={e => update(d.id, { entrantsStr: e.target.value })} />
                            </td>
                            <td className="px-2 py-0.5 whitespace-nowrap">
                                <button onClick={() => save(d)} disabled={!d.dirty}
                                    className="px-2 py-0.5 border rounded hover:bg-gray-100 disabled:opacity-40">保存</button>
                                <button onClick={() => remove(d)}
                                    className="ml-1 px-2 py-0.5 text-red-600 hover:underline">削除</button>
                            </td>
                        </tr>
                    ))}
                    <tr>
                        <td className="px-2 py-0.5">
                            <input className="w-40 px-1 border rounded" placeholder="例: 男子40歳代" value={newName}
                                onChange={e => setNewName(e.target.value)} />
                        </td>
                        <td className="px-2 py-0.5">
                            <input className="w-24 px-1 border rounded" inputMode="numeric" value={newEntrants}
                                onChange={e => setNewEntrants(e.target.value)} />
                        </td>
                        <td className="px-2 py-0.5">
                            <button onClick={add} className="px-2 py-0.5 bg-green-600 text-white rounded hover:bg-green-700">追加</button>
                        </td>
                    </tr>
                </tbody>
            </table>
            {unregistered.length > 0 && (
                <p className="mt-1 text-xs text-gray-600">
                    記録に入力されているが未登録の部門:
                    {unregistered.map(n => (
                        <button key={n} onClick={() => setNewName(n)} className="ml-2 text-blue-600 hover:underline">{n}</button>
                    ))}
                    <span className="ml-2 text-gray-500">（押すと部門名に入ります）</span>
                </p>
            )}
            {message && <p className={`mt-1 text-xs ${message.isError ? "text-red-600" : "text-green-700"}`}>{message.text}</p>}
        </div>
    )
}

// 部門名の入力候補（そのレースに登録済みの部門）。input の list 属性に id を指定して使う
export function DivisionDatalist({ id, raceId }: { id: string; raceId: number | null }) {
    const [names, setNames] = useState<string[]>([])
    useEffect(() => {
        if (raceId == null) { setNames([]); return }
        createClient().from("race_divisions").select("name").eq("race_id", raceId).order("name")
            .then(({ data }) => setNames((data ?? []).map(d => d.name)))
    }, [raceId])
    return <datalist id={id}>{names.map(n => <option key={n} value={n} />)}</datalist>
}
