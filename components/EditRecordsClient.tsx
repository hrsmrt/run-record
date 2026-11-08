"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { RaceDatalist, RaceInput, useRaceOptions } from "@/components/RaceInput"
import { MemberSelect } from "@/components/MemberSelect"
import { getAdminState } from "@/lib/admin"
import { countToStr, parseCount } from "@/lib/ranks"

type Record = {
  id: number
  name: string
  time_ms: number
  race_name: string
  race_type: string
  distance: number
  date: string
  comment?: string
  race_id: number | null
  clever_index: number | null
  overall_rank: number | null
  gender_rank: number | null
  division: string | null
  division_rank: number | null
}

// 入力欄の文字列（保存時に数値へ変換）
type RecordWithTimeStr = Record & {
  timeStr: string
  cleverStr: string
  overallRankStr: string
  genderRankStr: string
  divisionRankStr: string
}

const RANK_FIELDS = [
  ["overallRankStr", "総合順位"],
  ["genderRankStr", "男女別順位"],
] as const

export function EditRecordsClient() {
  const [records, setRecords] = useState<RecordWithTimeStr[]>([])
  const [sortKey, setSortKey] = useState<keyof Record>("date")
  const [sortAsc, setSortAsc] = useState(false)
  const [distanceFilter, setDistanceFilter] = useState<string>("all")
  const [raceTypeFilter, setRaceTypeFilter] = useState<string>("all")
  const [message, setMessage] = useState("")
  const { options: raceOptions, error: raceError } = useRaceOptions()

  const supabase = createClient()

  // ミリ秒 → hh:mm:ss.aa
  const msToTime = (ms: number) => {
    const hours = Math.floor(ms / 3600000)
    const minutes = Math.floor((ms % 3600000) / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    const centiseconds = Math.floor((ms % 1000) / 10)
    return `${String(hours).padStart(2,"0")}:${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}.${String(centiseconds).padStart(2,"0")}`
  }

  const timeToMs = (timeStr: string) => {
    const regex = /^(\d{1,2}):([0-5]\d):([0-5]\d)(?:\.(\d{1,2}))?$/
    const match = timeStr.match(regex)
    if (!match) return NaN
    const [, hh, mm, ss, aa] = match
    const hours = parseInt(hh, 10)
    const minutes = parseInt(mm, 10)
    const seconds = parseInt(ss, 10)
    const centiseconds = aa ? parseInt(aa, 10) : 0
    return hours*3600000 + minutes*60000 + seconds*1000 + centiseconds*10
  }

  // 管理者は編集対象のメンバーを選べる（それ以外は常に自分）
  const [selfId, setSelfId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  // 管理者機能は2段階認証済みのときだけ使える
  const [adminNeedsMfa, setAdminNeedsMfa] = useState(false)
  const [targetUserId, setTargetUserId] = useState<string | null>(null)

  useEffect(() => {
    getAdminState(supabase).then(({ user, isAdmin, adminActive }) => {
      if (!user) return
      setSelfId(user.id)
      setTargetUserId(user.id)
      setIsAdmin(adminActive)
      setAdminNeedsMfa(isAdmin && !adminActive)
    })
  }, [supabase])

  // データ取得
  useEffect(() => {
    const fetchRecords = async () => {
      if (!targetUserId) { setRecords([]); return }
      let query = supabase.from("results").select("*").eq("user_id", targetUserId)
      if (distanceFilter !== "all") {
        if (distanceFilter === "other_under_100") {
          query = query.lt("distance", 100).not("distance", "in", "(5,10,21.0975,42.195)")
        } else if (distanceFilter === "other_over_100") {
          query = query.gt("distance", 100)
        } else {
          query = query.eq("distance", Number(distanceFilter))
        }
      }
      if (raceTypeFilter !== "all") query = query.eq("race_type", raceTypeFilter)

      const { data } = await query
      const formatted = (data ?? []).map(r => ({
        ...r,
        timeStr: msToTime(r.time_ms),
        cleverStr: r.clever_index == null ? "" : String(r.clever_index),
        overallRankStr: countToStr(r.overall_rank),
        genderRankStr: countToStr(r.gender_rank),
        divisionRankStr: countToStr(r.division_rank),
      }))
      setRecords(formatted)
    }
    fetchRecords()
  }, [distanceFilter, raceTypeFilter, targetUserId, supabase])

  const updateRow = (id: number, patch: Partial<RecordWithTimeStr>) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  // ソート処理
  const handleSort = (key: keyof Record) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(true) }
  }

  const sortedRecords = [...records].sort((a,b) => {
    const valA = a[sortKey], valB = b[sortKey]
    if (valA === valB) return 0
    if (valA == null) return 1
    if (valB == null) return -1
    if (typeof valA === "number" && typeof valB === "number") return sortAsc ? valA - valB : valB - valA
    return sortAsc ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA))
  })

  // 保存
  const handleSaveAll = async () => {
    const updates = records.map(r => ({
      id: r.id,
      time_ms: timeToMs(r.timeStr),
      distance: r.distance,
      race_name: r.race_name,
      race_type: r.race_type,
      date: r.date,
      comment: r.comment,
      race_id: r.race_id,
      clever_index: r.cleverStr === "" ? null : Number(r.cleverStr),
      overall_rank: parseCount(r.overallRankStr),
      gender_rank: parseCount(r.genderRankStr),
      division: r.division?.trim() || null,
      division_rank: parseCount(r.divisionRankStr),
    }))
    const errors: string[] = []

    for (const u of updates) {
      if (isNaN(u.time_ms)) { errors.push(`ID ${u.id} の時間が不正です`); continue }
      if (isNaN(u.distance) || u.distance <= 0) { errors.push(`ID ${u.id} の距離を入力してください`); continue }
      if (u.clever_index !== null && isNaN(u.clever_index)) { errors.push(`ID ${u.id} のクレバー指数が不正です`); continue }
      if ([u.overall_rank, u.gender_rank, u.division_rank].includes(undefined)) { errors.push(`ID ${u.id} の順位は正の整数で入力してください`); continue }
      const { error } = await supabase.from("results").update({
        time_ms: u.time_ms,
        distance: u.distance,
        race_name: u.race_name,
        race_type: u.race_type,
        date: u.date,
        comment: u.comment,
        race_id: u.race_id,
        clever_index: u.clever_index,
        overall_rank: u.overall_rank,
        gender_rank: u.gender_rank,
        division: u.division,
        division_rank: u.division_rank,
      }).eq("id", u.id)
      if (error) errors.push(`ID ${u.id}: ${error.message}`)
    }

    setMessage(errors.length > 0 ? errors.join(", ") : "すべてのレコードを保存しました")
  }

  const handleDelete = async (id: number) => {
    if (!confirm("本当に削除しますか？")) return
    const { error } = await supabase.from("results").delete().eq("id", id)
    if (error) setMessage(`削除に失敗しました: ${error.message}`)
    else {
      setRecords(prev => prev.filter(r => r.id !== id))
      setMessage(`ID ${id} のレコードを削除しました`)
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto p-4">
      {adminNeedsMfa && (
        <p className="mb-4 text-xs text-gray-500">
          他のメンバーの記録を編集するには
          <Link href="/auth/mfa?next=/records/edit" className="text-blue-600 hover:underline">2段階認証</Link>
          が必要です
        </p>
      )}
      {isAdmin && selfId && targetUserId && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm font-semibold">編集するメンバー（管理人）</span>
          <MemberSelect selfId={selfId} value={targetUserId} onChange={setTargetUserId} className="px-2 py-1 border rounded" />
        </div>
      )}
      {/* フィルター */}
      <div className="flex gap-4 mb-4">
        <select value={distanceFilter} onChange={e => setDistanceFilter(e.target.value)} className="px-2 py-1 rounded">
          <option value="all">距離: 全て</option>
          <option value="5">5 km</option>
          <option value="10">10 km</option>
          <option value="21.0975">ハーフマラソン</option>
          <option value="42.195">フルマラソン</option>
          <option value="100">100 km</option>
          <option value="other_under_100">その他(100km未満)</option>
          <option value="other_over_100">その他(100km以上)</option>
        </select>

        <select value={raceTypeFilter} onChange={e => setRaceTypeFilter(e.target.value)} className="px-2 py-1 rounded">
          <option value="all">種別: 全て</option>
          <option value="road">ロード</option>
          <option value="trail">トレイル</option>
          <option value="track">トラック</option>
          <option value="time">時間走</option>
        </select>
      </div>

      <button onClick={handleSaveAll} className="mb-4 px-4 py-2 bg-blue-600 text-white rounded">保存</button>
      {message && <p className="mb-2">{message}</p>}
      {raceError && <p className="mb-2 text-red-600">大会情報の読み込みに失敗しました: {raceError}</p>}
      <p className="mb-2 text-sm text-gray-500">
        「大会情報」で登録済みの大会を選ぶと、大会名・日付・距離が大会情報の値になります（紐付け中は大会名・日付は編集不可）
      </p>

      {!raceOptions ? <p>読み込み中...</p> : (
      <div className="overflow-x-auto">
        <RaceDatalist id="race-options" options={raceOptions} />
        <table className="w-full min-w-[1700px] table-auto text-left border-collapse">
          <thead>
            <tr>
              <th className="px-2 py-1">ラップ</th>
              <th className="px-2 py-1 cursor-pointer" onClick={() => handleSort("time_ms")}>
                時間 {sortKey==="time_ms" ? (sortAsc?"↑":"↓"):""}
              </th>
              <th className="px-2 py-1">大会情報</th>
              <th className="px-2 py-1 cursor-pointer" onClick={() => handleSort("race_name")}>
                大会 {sortKey==="race_name" ? (sortAsc?"↑":"↓"):""}
              </th>
              <th className="px-2 py-1 cursor-pointer" onClick={() => handleSort("distance")}>
                距離(km) {sortKey==="distance" ? (sortAsc?"↑":"↓"):""}
              </th>
              <th className="px-2 py-1 cursor-pointer" onClick={() => handleSort("race_type")}>
                種別 {sortKey==="race_type" ? (sortAsc?"↑":"↓"):""}
              </th>
              <th className="px-2 py-1 cursor-pointer" onClick={() => handleSort("date")}>
                日付 {sortKey==="date" ? (sortAsc?"↑":"↓"):""}
              </th>
              <th className="px-2 py-1 cursor-pointer" onClick={() => handleSort("clever_index")}>
                クレバー指数 {sortKey==="clever_index" ? (sortAsc?"↑":"↓"):""}
              </th>
              {RANK_FIELDS.map(([, label]) => <th key={label} className="px-2 py-1">{label}</th>)}
              <th className="px-2 py-1">部門</th>
              <th className="px-2 py-1">部門順位</th>
              <th className="px-2 py-1 cursor-pointer" onClick={() => handleSort("comment")}>
                コメント {sortKey==="comment" ? (sortAsc?"↑":"↓"):""}
              </th>
              <th className="px-2 py-1">削除</th>
            </tr>
          </thead>
          <tbody>
            {sortedRecords.map(record => (
              <tr key={record.id}>
                <td className="px-2 py-1"><Link href={`/records/${record.id}/splits`} className="text-blue-600 hover:underline">入力</Link></td>
                <td className="px-2 py-1"><input className="w-28 px-1" value={record.timeStr} onChange={e => setRecords(prev => prev.map(r => r.id===record.id?{...r,timeStr:e.target.value}:r))}/></td>
                <td className="px-2 py-1">
                  <RaceInput
                    listId="race-options"
                    options={raceOptions}
                    value={record.race_id}
                    onChange={race => updateRow(record.id, race
                      ? { race_id: race.id, race_name: race.eventName, date: race.heldOn ?? record.date, distance: race.distanceKm }
                      : { race_id: null })}
                    className="w-72 px-1 border rounded"
                  />
                </td>
                <td className="px-2 py-1"><input className={`w-full px-1 ${record.race_id ? "bg-gray-100 text-gray-500" : ""}`} readOnly={record.race_id != null} value={record.race_name} onChange={e => setRecords(prev => prev.map(r => r.id===record.id?{...r,race_name:e.target.value}:r))}/></td>
                <td className="px-2 py-1"><input className="w-20 px-1" inputMode="decimal" value={Number.isNaN(record.distance) ? "" : record.distance} onChange={e => setRecords(prev => prev.map(r => r.id===record.id?{...r,distance:e.target.value.trim() === "" ? NaN : Number(e.target.value)}:r))}/></td>
                <td className="px-2 py-1">
                  <select value={record.race_type} onChange={e => setRecords(prev => prev.map(r => r.id===record.id?{...r,race_type:e.target.value}:r))}>
                    <option value=""></option>
                    <option value="road">ロード</option>
                    <option value="trail">トレイル</option>
                    <option value="track">トラック</option>
                    <option value="time">時間走</option>
                  </select>
                </td>
                <td className="px-2 py-1 w-36"><input type="date" className={`w-36 px-1 ${record.race_id ? "bg-gray-100 text-gray-500" : ""}`} readOnly={record.race_id != null} value={record.date} onChange={e => setRecords(prev => prev.map(r => r.id===record.id?{...r,date:e.target.value}:r))}/></td>
                <td className="px-2 py-1"><input className="w-20 px-1" inputMode="decimal" value={record.cleverStr} onChange={e => updateRow(record.id, { cleverStr: e.target.value })}/></td>
                {RANK_FIELDS.map(([field]) => (
                  <td key={field} className="px-2 py-1"><input className="w-20 px-1" inputMode="numeric" value={record[field]} onChange={e => updateRow(record.id, { [field]: e.target.value })}/></td>
                ))}
                <td className="px-2 py-1"><input className="w-32 px-1" value={record.division ?? ""} onChange={e => updateRow(record.id, { division: e.target.value })}/></td>
                <td className="px-2 py-1"><input className="w-20 px-1" inputMode="numeric" value={record.divisionRankStr} onChange={e => updateRow(record.id, { divisionRankStr: e.target.value })}/></td>
                <td className="px-2 py-1"><input className="w-full px-1" value={record.comment??""} onChange={e => setRecords(prev => prev.map(r => r.id===record.id?{...r,comment:e.target.value}:r))}/></td>
                <td className="px-2 py-1"><button onClick={()=>handleDelete(record.id)} className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700">削除</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  )
}