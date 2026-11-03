"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useUnsavedWarning } from "@/lib/use-unsaved-warning"

type Result = {
    id: number
    race_name: string
    date: string | null
    distance: number | null
    time_ms: number | null
}

type SplitRow = {
    key: number
    distanceStr: string
    timeStr: string
}

// "1:23:45" / "23:45" / "23:45.6" → ミリ秒。不正なら null
const parseElapsed = (str: string): number | null => {
    const m = str.trim().match(/^(?:(\d{1,2}):)?(\d{1,2}):([0-5]\d)(?:\.(\d{1,2}))?$/)
    if (!m) return null
    const [, hh, mm, ss, cc] = m
    if (hh !== undefined && Number(mm) > 59) return null
    return (Number(hh ?? 0) * 3600 + Number(mm) * 60 + Number(ss)) * 1000 + (cc ? Number(cc.padEnd(2, "0")) * 10 : 0)
}

// ミリ秒 → "1:23:45" / "23:45"（1/100秒があれば ".67" を付ける）
const formatElapsed = (ms: number) => {
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    const cc = Math.floor((ms % 1000) / 10)
    const base = h > 0
        ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
        : `${m}:${String(s).padStart(2, "0")}`
    return cc > 0 ? `${base}.${String(cc).padStart(2, "0")}` : base
}

const formatPace = (msPerKm: number) => {
    const total = Math.round(msPerKm / 1000)
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}/km`
}

const isFull = (km: number) => Math.abs(km - 42.195) < 0.001
const HALF_KM = 21.0975

// 区間表示用の地点名
const pointLabel = (km: number) =>
    km === 0 ? "スタート" : Math.abs(km - HALF_KM) < 0.001 ? "ハーフ" : `${km}km`

const formatDistance = (km: number) =>
    Math.abs(km - 42.195) < 0.001 ? "フル" : Math.abs(km - 21.0975) < 0.001 ? "ハーフ" : `${km}km`

export default function SplitsPage() {
    const { id } = useParams<{ id: string }>()
    const resultId = Number(id)
    const [result, setResult] = useState<Result | null>(null)
    const [rows, setRows] = useState<SplitRow[]>([])
    const [status, setStatus] = useState<"loading" | "notFound" | "ok">("loading")
    const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)
    const [dirty, setDirty] = useState(false)
    const [pointInterval, setPointInterval] = useState("5")
    const [nextKey, setNextKey] = useState(0)

    useUnsavedWarning(dirty)

    const loadSplits = useCallback(async () => {
        const supabase = createClient()
        const { data, error } = await supabase
            .from("result_splits")
            .select("distance_km, elapsed_ms")
            .eq("result_id", resultId)
            .order("distance_km")
        if (error) { setMessage({ text: `ラップの読み込みに失敗しました: ${error.message}`, isError: true }); return }
        const saved = (data ?? []).map((s, i) => ({
            key: i,
            distanceStr: String(Number(s.distance_km)),
            timeStr: formatElapsed(s.elapsed_ms),
        }))
        // 未登録ならスタート行（ロス 0:00）を最初から表示しておく
        setRows(saved.length > 0 ? saved : [{ key: 0, distanceStr: "0", timeStr: "0:00" }])
        setNextKey(Math.max(saved.length, 1))
        setDirty(false)
    }, [resultId])

    useEffect(() => {
        const fetch = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user || !Number.isInteger(resultId)) { setStatus("notFound"); return }
            const { data, error } = await supabase
                .from("results")
                .select("id, race_name, date, distance, time_ms")
                .eq("id", resultId)
                .eq("user_id", user.id)
                .maybeSingle()
            if (error || !data) { setStatus("notFound"); return }
            setResult(data)
            await loadSplits()
            setStatus("ok")
        }
        fetch()
    }, [resultId, loadSplits])

    const addRow = (distanceStr = "", timeStr = "") => {
        setRows(prev => [...prev, { key: nextKey, distanceStr, timeStr }])
        setNextKey(k => k + 1)
        setDirty(true)
    }

    const updateRow = (key: number, patch: Partial<SplitRow>) => {
        setRows(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r))
        setDirty(true)
    }

    const removeRow = (key: number) => {
        setRows(prev => prev.filter(r => r.key !== key))
        setDirty(true)
    }

    const hasStart = rows.some(r => r.distanceStr.trim() !== "" && Number(r.distanceStr) === 0)

    // スタート地点（0km、号砲からスタートライン通過までのロス）を先頭に追加
    const addStart = () => {
        if (hasStart) return
        setRows(prev => [{ key: nextKey, distanceStr: "0", timeStr: "0:00" }, ...prev])
        setNextKey(k => k + 1)
        setDirty(true)
    }

    // スタート・一定間隔の通過地点・ゴールを追加（入力済みの地点はそのまま残す）
    const fillPoints = () => {
        if (!result?.distance) return
        const step = Number(pointInterval)
        const existing = new Set(rows.filter(r => r.distanceStr.trim() !== "").map(r => Number(r.distanceStr)))
        const points: number[] = [0]
        for (let i = 1; i * step < result.distance - 0.001; i++) points.push(i * step)
        // フルマラソンは中間点（ハーフ）も追加
        if (isFull(result.distance)) points.push(HALF_KM)
        points.push(result.distance)
        const added = points
            .filter(d => !existing.has(d))
            .map((d, i) => ({
                key: nextKey + i,
                distanceStr: String(d),
                // スタートはロス 0:00、ゴールは「ロス + 記録（ネット）」を入れておく
                timeStr: d === 0
                    ? "0:00"
                    : d === result.distance && result.time_ms ? formatElapsed((startMs ?? 0) + result.time_ms) : "",
            }))
        setRows(prev => [...prev, ...added].sort((a, b) => Number(a.distanceStr) - Number(b.distanceStr)))
        setNextKey(k => k + added.length)
        setDirty(true)
    }

    // 区間ラップ表示用：距離順に並べ、入力が正しい行だけで前の地点との差を計算
    const parsed = rows.map(r => ({
        ...r,
        km: r.distanceStr.trim() === "" ? NaN : Number(r.distanceStr),
        ms: parseElapsed(r.timeStr),
    }))
    // スタートのロス（号砲 → スタートライン通過）。ネット = 通過タイム − ロス
    const startMs = parsed.find(r => r.km === 0)?.ms ?? null
    const goal = result?.distance != null ? parsed.find(r => Math.abs(r.km - result.distance!) < 0.001) : undefined
    const goalNetMismatch = goal?.ms != null && result?.time_ms != null && startMs != null
        && Math.abs(goal.ms - startMs - result.time_ms) >= 1000

    const ordered = [...parsed]
        .filter(r => !isNaN(r.km) && r.km >= 0 && r.ms !== null)
        .sort((a, b) => a.km - b.km)
    const lapByKey = new Map<number, { fromKm: number; lapMs: number; pace: number }>()
    ordered.forEach((r, i) => {
        const prev = i > 0 ? ordered[i - 1] : { km: 0, ms: 0 }
        const lapMs = r.ms! - prev.ms!
        const segKm = r.km - prev.km
        if (lapMs > 0 && segKm > 0) lapByKey.set(r.key, { fromKm: prev.km, lapMs, pace: lapMs / segKm })
    })

    const validate = (): string[] => {
        const errors: string[] = []
        parsed.forEach((r, i) => {
            const n = i + 1
            if (isNaN(r.km) || r.km < 0) errors.push(`${n}行目: 通過地点は 0（スタート）以上の数で入力してください`)
            if (r.ms === null) errors.push(`${n}行目: 通過タイムは 1:23:45 または 23:45 の形式で入力してください`)
            // スタートのロスは 0:00 でもよいが、それ以外の地点は 0 より後
            else if (r.km > 0 && r.ms <= 0) errors.push(`${n}行目: 通過タイムが 0 になっています`)
        })
        if (errors.length > 0) return errors
        const kms = parsed.map(r => r.km)
        if (new Set(kms).size !== kms.length) errors.push("同じ通過地点が複数あります")
        const sorted = [...parsed].sort((a, b) => a.km - b.km)
        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i].ms! <= sorted[i - 1].ms!) {
                errors.push(`${sorted[i].km}km の通過タイムが ${sorted[i - 1].km}km 以前になっています`)
            }
        }
        return errors
    }

    const handleSave = async () => {
        const errors = validate()
        if (errors.length > 0) { setMessage({ text: errors.join(" / "), isError: true }); return }

        const supabase = createClient()
        // 先に通過地点単位で upsert し、その後で画面にない地点を削除する
        // （途中で失敗しても、入力済みのラップが消えることはない）
        if (parsed.length > 0) {
            const { error } = await supabase.from("result_splits").upsert(
                parsed.map(r => ({ result_id: resultId, distance_km: r.km, elapsed_ms: r.ms! })),
                { onConflict: "result_id,distance_km" },
            )
            if (error) { setMessage({ text: `保存に失敗しました: ${error.message}`, isError: true }); return }
        }
        const { data: current, error: fetchError } = await supabase
            .from("result_splits").select("id, distance_km").eq("result_id", resultId)
        if (fetchError) { setMessage({ text: `保存に失敗しました: ${fetchError.message}`, isError: true }); return }
        const keptKms = new Set(parsed.map(r => r.km))
        const deleteIds = (current ?? []).filter(s => !keptKms.has(Number(s.distance_km))).map(s => s.id)
        if (deleteIds.length > 0) {
            const { error } = await supabase.from("result_splits").delete().in("id", deleteIds)
            if (error) { setMessage({ text: `保存に失敗しました: ${error.message}`, isError: true }); return }
        }
        await loadSplits()
        setMessage({ text: "保存しました", isError: false })
    }

    if (status === "loading") return <p className="p-4">読み込み中...</p>
    if (status === "notFound" || !result) {
        return <p className="p-4">記録が見つからないか、この記録を編集する権限がありません。</p>
    }

    return (
        <div className="max-w-3xl mx-auto p-4 text-black">
            <Link href="/records/edit" className="text-sm text-blue-600 hover:underline">← 記録を編集に戻る</Link>
            <h1 className="text-2xl font-bold mt-2 mb-1">ラップ入力</h1>
            <p className="mb-4 text-sm">
                {result.race_name}
                {result.date && `（${result.date.replaceAll("-", "/")}）`}
                {result.distance != null && ` ${formatDistance(result.distance)}`}
                {result.time_ms != null && ` 記録 ${formatElapsed(result.time_ms)}`}
            </p>

            <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
                <select value={pointInterval} onChange={e => setPointInterval(e.target.value)} className="px-1 py-1 border rounded">
                    <option value="1">1kmごと</option>
                    <option value="5">5kmごと</option>
                    <option value="10">10kmごと</option>
                </select>
                <button
                    onClick={fillPoints}
                    disabled={!result.distance}
                    className="px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                >
                    通過地点をまとめて追加
                </button>
                <button
                    onClick={addStart}
                    disabled={hasStart}
                    className="px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                >
                    スタートを追加
                </button>
                <button onClick={() => addRow()} className="px-2 py-1 border rounded hover:bg-gray-100">
                    1行追加
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="table-auto text-left border-collapse text-sm whitespace-nowrap">
                    <thead>
                        <tr className="border-b">
                            <th className="px-2 py-1">通過地点(km)</th>
                            <th className="px-2 py-1">通過タイム</th>
                            <th className="px-2 py-1 text-right">ネット</th>
                            <th className="px-2 py-1">区間</th>
                            <th className="px-2 py-1 text-right">区間タイム</th>
                            <th className="px-2 py-1 text-right">ペース</th>
                            <th className="px-2 py-1">削除</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(r => {
                            const lap = lapByKey.get(r.key)
                            const km = Number(r.distanceStr)
                            return (
                                <tr key={r.key} className="border-b">
                                    <td className="px-2 py-1">
                                        <input
                                            className="w-20 px-1 border rounded"
                                            inputMode="decimal"
                                            value={r.distanceStr}
                                            onChange={e => updateRow(r.key, { distanceStr: e.target.value })}
                                        />
                                    </td>
                                    <td className="px-2 py-1">
                                        <input
                                            className={`w-24 px-1 border rounded ${r.timeStr && parseElapsed(r.timeStr) === null ? "border-red-500" : ""}`}
                                            placeholder="1:23:45"
                                            value={r.timeStr}
                                            onChange={e => updateRow(r.key, { timeStr: e.target.value })}
                                        />
                                    </td>
                                    <td className="px-2 py-1 text-right">
                                        {(() => {
                                            const ms = parseElapsed(r.timeStr)
                                            return km > 0 && ms !== null && startMs !== null && ms >= startMs
                                                ? formatElapsed(ms - startMs) : ""
                                        })()}
                                    </td>
                                    <td className="px-2 py-1 text-gray-500">
                                        {r.distanceStr.trim() !== "" && km === 0
                                            ? "スタート（ロス）"
                                            : lap ? `${pointLabel(lap.fromKm)}〜${pointLabel(km)}` : ""}
                                    </td>
                                    <td className="px-2 py-1 text-right">{lap ? formatElapsed(lap.lapMs) : ""}</td>
                                    <td className="px-2 py-1 text-right">{lap ? formatPace(lap.pace) : ""}</td>
                                    <td className="px-2 py-1">
                                        <button
                                            onClick={() => removeRow(r.key)}
                                            className="px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700"
                                        >
                                            削除
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            {rows.length === 0 && <p className="mt-2 text-sm text-gray-500">ラップはまだ登録されていません。</p>}
            {goalNetMismatch && (
                <p className="mt-2 text-sm text-orange-600">
                    ゴールのネット（{formatElapsed(goal!.ms! - startMs!)}）が記録（{formatElapsed(result.time_ms!)}）と一致しません。
                    スタートのロスかゴールの通過タイムを確認してください。
                </p>
            )}

            <div className="mt-4 flex items-center gap-3">
                <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    保存
                </button>
                {dirty && <span className="text-sm text-gray-500">未保存の変更があります</span>}
            </div>
            {message && (
                <p className={`mt-2 text-sm ${message.isError ? "text-red-600" : "text-green-700"}`}>{message.text}</p>
            )}
            <p className="mt-4 text-xs text-gray-500">
                ※ 通過タイムは号砲からの経過時間（グロス）で入力します。
                <br />
                ※ 「スタート」（0km）には、号砲からスタートラインを通過するまでのロスタイムを入力します。ロスがなければ 0:00 のままで構いません。
                <br />
                ※ ネット（通過タイム − ロス）は自動計算されます。ゴールのネットが記録（ネットタイム）と一致するはずです。
            </p>
        </div>
    )
}
