"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { formatTime } from "@/lib/utils"
import { formatDistance, parseElapsed } from "@/lib/splits"
import { useUnsavedWarning } from "@/lib/use-unsaved-warning"
import { RaceDatalist, RaceInput, RaceOption, useRaceOptions } from "@/components/RaceInput"
import { DivisionDatalist } from "@/components/RaceDivisionsEditor"
import { formatRank, parseCount } from "@/lib/ranks"
import { parseEnrollmentYear } from "@/lib/enrollment"

type Member = { user_id: string; name: string | null; pending_auth: boolean }

type ExistingResult = {
    id: number
    user_id: string
    time_ms: number
    clever_index: number | null
    overall_rank: number | null
    division: string | null
    division_rank: number | null
    comment: string | null
}

type EntryRow = {
    key: number
    userId: string
    timeStr: string
    cleverStr: string
    overallRankStr: string
    genderRankStr: string
    division: string
    divisionRankStr: string
    comment: string
}

// 順位・部門の入力欄（placeholder は列見出しの代わりの例）
const RANK_COLUMNS = [
    { field: "overallRankStr", label: "総合順位", width: "w-20" },
    { field: "genderRankStr", label: "男女別順位", width: "w-20" },
    { field: "division", label: "部門", width: "w-32" },
    { field: "divisionRankStr", label: "部門順位", width: "w-20" },
] as const

const RACE_TYPES = [
    { value: "road", label: "ロード" },
    { value: "trail", label: "トレイル" },
    { value: "track", label: "トラック" },
    { value: "time", label: "時間走" },
]

// 大会の種別（events.type）から結果の種別（results.race_type）の初期値を決める
const defaultRaceType = (eventType: string) =>
    eventType === "trail" ? "trail" : eventType === "track" || eventType === "time_trial" ? "track" : "road"

const emptyRow = (key: number): EntryRow => ({
    key, userId: "", timeStr: "", cleverStr: "", overallRankStr: "", genderRankStr: "", division: "", divisionRankStr: "", comment: "",
})

// 何か入力されている行か（メンバー以外も含む）
const isFilled = (r: EntryRow) =>
    !!(r.userId || r.timeStr || r.cleverStr || r.overallRankStr || r.genderRankStr || r.division || r.divisionRankStr || r.comment)

// 管理者が1つのレースについて複数人の記録をまとめて登録する
export function BulkResultsClient() {
    const { options: raceOptions, error: raceError } = useRaceOptions()
    const [members, setMembers] = useState<Member[]>([])
    const [race, setRace] = useState<RaceOption | null>(null)
    const [raceType, setRaceType] = useState("road")
    const [existing, setExisting] = useState<ExistingResult[]>([])
    const [rows, setRows] = useState<EntryRow[]>([emptyRow(0)])
    const [nextKey, setNextKey] = useState(1)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)
    // レース選択欄を空に戻すためのキー
    const [raceInputKey, setRaceInputKey] = useState(0)
    // メンバー一覧にいない人（アカウントなし）の追加
    const [newName, setNewName] = useState("")
    const [newGender, setNewGender] = useState("")
    const [newEnrollment, setNewEnrollment] = useState("")
    const [adding, setAdding] = useState(false)

    const dirty = rows.some(isFilled)
    useUnsavedWarning(dirty)

    useEffect(() => {
        const fetch = async () => {
            const { data, error } = await createClient().from("admin_members").select("user_id, name, pending_auth")
            if (error) { setMessage({ text: `メンバー一覧の読み込みに失敗しました: ${error.message}`, isError: true }); return }
            setMembers(((data ?? []) as Member[]).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")))
        }
        fetch()
    }, [])

    const loadExisting = async (raceId: number) => {
        const { data, error } = await createClient()
            .from("results")
            .select("id, user_id, time_ms, clever_index, overall_rank, division, division_rank, comment")
            .eq("race_id", raceId)
            .order("time_ms")
        if (error) { setMessage({ text: `登録済みの記録の読み込みに失敗しました: ${error.message}`, isError: true }); return }
        setExisting((data ?? []) as ExistingResult[])
    }

    const selectRace = (option: RaceOption | null) => {
        setRace(option)
        setMessage(null)
        setExisting([])
        if (option) {
            setRaceType(defaultRaceType(option.eventType))
            loadExisting(option.id)
        }
    }

    // profiles_pending に1人追加し、空いている入力行（なければ新しい行）で選んだ状態にする
    const handleAddPerson = async () => {
        const name = newName.trim()
        if (!name) { setMessage({ text: "追加する人の名前を入力してください", isError: true }); return }
        if (!newGender) { setMessage({ text: "追加する人の性別を選んでください", isError: true }); return }
        const enrollmentYear = parseEnrollmentYear(newEnrollment)
        if (enrollmentYear === undefined) { setMessage({ text: "入学年度は西暦4桁（例: 2017）で入力してください", isError: true }); return }
        if (members.some(m => m.name === name) && !confirm(`「${name}」は一覧にすでにいます。別人として追加しますか？`)) return
        setAdding(true)
        // ID は DB の既定値で作らせる（任意の ID を指定して既存メンバーと重複させないため）
        const { data, error } = await createClient()
            .from("profiles_pending")
            // name（名前）と display_name（表示名。公開されるのはこちら）の両方に入れる
            .insert({ name, display_name: name, gender: newGender, enrollment_year: enrollmentYear, pending_auth: true })
            .select("id")
            .single()
        setAdding(false)
        if (error) { setMessage({ text: `追加に失敗しました: ${error.message}`, isError: true }); return }
        const id: string = data.id
        setMembers(prev => [...prev, { user_id: id, name, pending_auth: true }].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")))
        setNewName("")
        setNewGender("")
        setNewEnrollment("")
        setMessage({ text: `「${name}」を追加しました`, isError: false })
        const blank = rows.find(r => !r.userId)
        if (blank) updateRow(blank.key, { userId: id })
    }

    const memberName = (userId: string) => members.find(m => m.user_id === userId)?.name ?? "名前未設定"
    const registeredIds = new Set(existing.map(e => e.user_id))

    const updateRow = (key: number, patch: Partial<EntryRow>) => {
        setRows(prev => {
            const next = prev.map(r => r.key === key ? { ...r, ...patch } : r)
            // 最後の行でメンバーを選んだら、次の空行を自動で足す
            const last = next[next.length - 1]
            if (last.userId) {
                next.push(emptyRow(nextKey))
                setNextKey(k => k + 1)
            }
            return next
        })
    }

    const removeRow = (key: number) => {
        setRows(prev => {
            const next = prev.filter(r => r.key !== key)
            return next.length > 0 ? next : [emptyRow(nextKey)]
        })
        setNextKey(k => k + 1)
    }

    const handleSave = async () => {
        if (!race) { setMessage({ text: "レースを選んでください", isError: true }); return }
        const filled = rows.filter(isFilled)
        if (filled.length === 0) { setMessage({ text: "登録する記録を入力してください", isError: true }); return }

        const errors: string[] = []
        const seen = new Set<string>()
        const inserts = filled.map((r, i) => {
            const n = i + 1
            if (!r.userId) errors.push(`${n}行目: メンバーを選んでください`)
            else if (seen.has(r.userId)) errors.push(`${n}行目: ${memberName(r.userId)} が重複しています`)
            seen.add(r.userId)
            const ms = parseElapsed(r.timeStr)
            if (ms === null || ms <= 0) errors.push(`${n}行目: タイムは 3:12:34 または 45:12 の形式で入力してください`)
            if (r.cleverStr !== "" && isNaN(Number(r.cleverStr))) errors.push(`${n}行目: クレバー指数は数値で入力してください`)
            const ranks = {
                overall_rank: parseCount(r.overallRankStr),
                gender_rank: parseCount(r.genderRankStr),
                division_rank: parseCount(r.divisionRankStr),
            }
            if (Object.values(ranks).includes(undefined)) errors.push(`${n}行目: 順位は正の整数で入力してください`)
            return {
                user_id: r.userId,
                race_id: race.id,
                race_name: race.eventName,
                date: race.heldOn,
                distance: race.distanceKm,
                race_type: raceType,
                time_ms: ms ?? 0,
                clever_index: r.cleverStr === "" ? null : Number(r.cleverStr),
                ...ranks,
                division: r.division.trim() || null,
                comment: r.comment.trim() === "" ? null : r.comment.trim(),
            }
        })
        if (!race.heldOn) errors.push("開催日が未定のレースには登録できません（開催日編集で日付を入れてください）")
        if (errors.length > 0) { setMessage({ text: errors.join(" / "), isError: true }); return }

        setSaving(true)
        const { error } = await createClient().from("results").insert(inserts)
        setSaving(false)
        if (error) { setMessage({ text: `保存に失敗しました: ${error.message}`, isError: true }); return }
        setMessage({ text: `${inserts.length}件の記録を登録しました`, isError: false })
        setRows([emptyRow(nextKey)])
        setNextKey(k => k + 1)
        loadExisting(race.id)
    }

    const changeRace = () => {
        if (dirty && !confirm("入力中の記録は破棄されます。レースを選び直しますか？")) return
        setRows([emptyRow(nextKey)])
        setNextKey(k => k + 1)
        setRaceInputKey(k => k + 1)
        selectRace(null)
    }

    return (
        <div className="max-w-7xl mx-auto p-4 text-black">
            {/* 1. レース選択 */}
            <section className="mb-6">
                <h2 className="font-semibold mb-1">1. レースを選ぶ</h2>
                {raceError && <p className="text-sm text-red-600">大会情報の読み込みに失敗しました: {raceError}</p>}
                {!raceOptions ? <p className="text-sm">読み込み中...</p> : (
                    <div className="flex flex-wrap items-center gap-2">
                        <RaceInput
                            key={raceInputKey}
                            listId="bulk-race-options"
                            options={raceOptions}
                            value={race?.id ?? null}
                            onChange={selectRace}
                            className="w-96 max-w-full px-2 py-1 border rounded bg-white"
                        />
                        <RaceDatalist id="bulk-race-options" options={raceOptions} />
                        {race && <button onClick={changeRace} className="text-sm text-blue-600 hover:underline">選び直す</button>}
                    </div>
                )}
                <p className="mt-1 text-xs text-gray-500">
                    一覧にないレースは、先に「大会編集」「開催日編集」「種目編集」で登録してください
                </p>
                {race && (
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                        <span>{race.eventName}</span>
                        <span>{race.heldOn ? race.heldOn.replaceAll("-", "/") : "開催日未定"}</span>
                        <span>{formatDistance(race.distanceKm)}</span>
                        <label className="flex items-center gap-1">
                            種別:
                            <select value={raceType} onChange={e => setRaceType(e.target.value)} className="border rounded px-1 py-0.5 bg-white">
                                {RACE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </label>
                    </div>
                )}
            </section>

            {race && (
                <>
                    {/* 2. 登録済み */}
                    <section className="mb-6">
                        <h2 className="font-semibold mb-1">2. 登録済みの記録（{existing.length}件）</h2>
                        {existing.length === 0 ? (
                            <p className="text-sm text-gray-500">まだ登録されていません</p>
                        ) : (
                            <table className="text-sm border-collapse">
                                <tbody>
                                    {existing.map(e => (
                                        <tr key={e.id} className="border-b">
                                            <td className="px-2 py-0.5">{memberName(e.user_id)}</td>
                                            <td className="px-2 py-0.5 text-right font-mono">{formatTime(e.time_ms)}</td>
                                            <td className="px-2 py-0.5 text-right">{e.clever_index ?? ""}</td>
                                            <td className="px-2 py-0.5 text-right">{formatRank(e.overall_rank)}</td>
                                            <td className="px-2 py-0.5">{e.division ?? ""} {formatRank(e.division_rank)}</td>
                                            <td className="px-2 py-0.5 text-gray-600">{e.comment ?? ""}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        <p className="mt-1 text-xs text-gray-500">
                            登録済みの記録の修正・削除・ラップ入力は <Link href="/records/edit" className="text-blue-600 hover:underline">記録を編集</Link> から
                        </p>
                    </section>

                    {/* 3. 入力 */}
                    <section>
                        <h2 className="font-semibold mb-1">3. 記録を入力する</h2>
                        <DivisionDatalist id="bulk-division-options" raceId={race.id} />
                        <div className="overflow-x-auto">
                            <table className="text-sm border-collapse">
                                <thead>
                                    <tr className="border-b text-left">
                                        <th className="px-2 py-1">メンバー</th>
                                        <th className="px-2 py-1">タイム（ネット）</th>
                                        <th className="px-2 py-1">クレバー指数</th>
                                        {RANK_COLUMNS.map(c => <th key={c.field} className="px-2 py-1">{c.label}</th>)}
                                        <th className="px-2 py-1">備考</th>
                                        <th className="px-2 py-1"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map(r => {
                                        const timeInvalid = r.timeStr !== "" && parseElapsed(r.timeStr) === null
                                        return (
                                            <tr key={r.key} className="border-b">
                                                <td className="px-2 py-1">
                                                    <select
                                                        value={r.userId}
                                                        onChange={e => updateRow(r.key, { userId: e.target.value })}
                                                        className="w-48 border rounded px-1 py-0.5 bg-white"
                                                    >
                                                        <option value="">選んでください</option>
                                                        {members.map(m => (
                                                            <option key={m.user_id} value={m.user_id}>
                                                                {m.name ?? "名前未設定"}
                                                                {m.pending_auth ? "（アカウントなし）" : ""}
                                                                {registeredIds.has(m.user_id) ? "（登録済み）" : ""}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-2 py-1">
                                                    <input
                                                        value={r.timeStr}
                                                        placeholder="3:12:34"
                                                        onChange={e => updateRow(r.key, { timeStr: e.target.value })}
                                                        className={`w-24 border rounded px-1 py-0.5 font-mono ${timeInvalid ? "border-red-500" : ""}`}
                                                    />
                                                </td>
                                                <td className="px-2 py-1">
                                                    <input
                                                        value={r.cleverStr}
                                                        inputMode="decimal"
                                                        onChange={e => updateRow(r.key, { cleverStr: e.target.value })}
                                                        className="w-20 border rounded px-1 py-0.5"
                                                    />
                                                </td>
                                                {RANK_COLUMNS.map(c => (
                                                    <td key={c.field} className="px-2 py-1">
                                                        <input
                                                            value={r[c.field]}
                                                            inputMode={c.field === "division" ? undefined : "numeric"}
                                                            list={c.field === "division" ? "bulk-division-options" : undefined}
                                                            onChange={e => updateRow(r.key, { [c.field]: e.target.value })}
                                                            className={`${c.width} border rounded px-1 py-0.5`}
                                                        />
                                                    </td>
                                                ))}
                                                <td className="px-2 py-1">
                                                    <input
                                                        value={r.comment}
                                                        onChange={e => updateRow(r.key, { comment: e.target.value })}
                                                        className="w-48 border rounded px-1 py-0.5"
                                                    />
                                                </td>
                                                <td className="px-2 py-1">
                                                    <button onClick={() => removeRow(r.key)} className="text-xs text-red-600 hover:underline">削除</button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                            <span className="text-gray-600">一覧にいない人を追加:</span>
                            <input
                                value={newName}
                                placeholder="表示名"
                                onChange={e => setNewName(e.target.value)}
                                className="w-40 border rounded px-1 py-0.5"
                            />
                            <select value={newGender} onChange={e => setNewGender(e.target.value)} className="border rounded px-1 py-0.5 bg-white">
                                <option value="">性別</option>
                                <option value="male">男性</option>
                                <option value="female">女性</option>
                            </select>
                            <input
                                value={newEnrollment}
                                placeholder="入学年度"
                                inputMode="numeric"
                                onChange={e => setNewEnrollment(e.target.value)}
                                className="w-20 border rounded px-1 py-0.5"
                            />
                            <button
                                onClick={handleAddPerson}
                                disabled={adding}
                                className="px-2 py-0.5 border rounded hover:bg-gray-100 disabled:opacity-50"
                            >
                                {adding ? "追加中..." : "追加"}
                            </button>
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                                {saving ? "登録中..." : "まとめて登録"}
                            </button>
                            {dirty && <span className="text-sm text-gray-500">未登録の入力があります</span>}
                        </div>
                    </section>
                </>
            )}

            {message && (
                <p className={`mt-3 text-sm ${message.isError ? "text-red-600" : "text-green-700"}`}>{message.text}</p>
            )}
            <p className="mt-6 text-xs text-gray-500">
                ※ 大会名・日付・距離は選んだレースの情報で登録されます。タイムはネットタイムを推奨（グロスは備考へ）。
                「（アカウントなし）」はアカウントを持たない OBOG です（入学年度はメンバー編集で後から直せます）。
                順位は大会の公式順位をそのまま、部門名は大会の表記のまま入力します（部門のエントリー数は種目編集で登録）。
            </p>
        </div>
    )
}
