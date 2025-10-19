"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { formatTime } from "@/lib/utils"

type Record = {
  id: number
  name: string
  time_ms: number
  race_name: string
  race_type: string
  distance: number
  date: string
  comment?: string
}

export default function Page() {
  const [records, setRecords] = useState<Record[]>([])
  const [sortKey, setSortKey] = useState<keyof Record>("date")
  const [sortAsc, setSortAsc] = useState(false)

  const [distanceFilter, setDistanceFilter] = useState<string>("all")
  const [raceTypeFilter, setRaceTypeFilter] = useState<string>("all")

  useEffect(() => {
    const fetchRecords = async () => {
      const supabase = await createClient()
      let query = supabase.from("results").select("*")

      if (distanceFilter !== "all") {
        if (distanceFilter === "other_under_100") {
          query = query.lt("distance", 100).not("distance", "in", "(5,10,21.0975,42.195)")
        } else if (distanceFilter === "other_over_100") {
          query = query.gt("distance", 100)
        } else {
          query = query.eq("distance", Number(distanceFilter))
        }
      }

      if (raceTypeFilter !== "all") {
        query = query.eq("race_type", raceTypeFilter)
      }

      const { data } = await query
      setRecords(data ?? [])
    }
    fetchRecords()
  }, [distanceFilter, raceTypeFilter])

  const handleSort = (key: keyof Record) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const sortedRecords = [...records].sort((a, b) => {
    const valA = a[sortKey]
    const valB = b[sortKey]

    if (valA === valB) return 0
    if (valA === null || valA === undefined) return 1
    if (valB === null || valB === undefined) return -1

    if (typeof valA === "number" && typeof valB === "number") {
      return sortAsc ? valA - valB : valB - valA
    }
    return sortAsc
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA))
  })

  return (
    <div className="max-w-4xl mx-auto p-1 bg-white text-black text-[10px] md:text-base overflow-x-auto">
      {/* 絞り込みUI */}
      <div className="flex gap-4 mb-4">
        <select
          value={distanceFilter}
          onChange={(e) => setDistanceFilter(e.target.value)}
          className="border px-1 py-0 rounded bg-white text-black"
        >
          <option value="all">距離: 全て</option>
          <option value="5">5 km</option>
          <option value="10">10 km</option>
          <option value="21.0975">ハーフマラソン</option>
          <option value="42.195">フルマラソン</option>
          <option value="100">100 km</option>
          <option value="other_under_100">その他(100km未満)</option>
          <option value="other_over_100">その他(100km以上)</option>
        </select>

        <select
          value={raceTypeFilter}
          onChange={(e) => setRaceTypeFilter(e.target.value)}
          className="border px-1 py-0 rounded bg-white text-black"
        >
          <option value="all">種別: 全て</option>
          <option value="road">ロード</option>
          <option value="trail">トレイル</option>
          <option value="track">トラック</option>
          <option value="time">時間走</option>
        </select>
      </div>

      <table className="w-full table-auto text-left whitespace-nowrap font-mono">
        <thead>
          <tr>
            <th className="px-1 md:px-3 py-0"></th>
            <th className="px-1 py-0 cursor-pointer text-center" onClick={() => handleSort("time_ms")}>
              記録 {sortKey === "time_ms" ? (sortAsc ? "↑" : "↓") : ""}
            </th>
            <th className="px-1 py-0 cursor-pointer text-center" onClick={() => handleSort("comment")}>
              備考 {sortKey === "comment" ? (sortAsc ? "↑" : "↓") : ""}
            </th>
            <th className="px-1 py-0 cursor-pointer text-center" onClick={() => handleSort("race_name")}>
              大会 {sortKey === "race_name" ? (sortAsc ? "↑" : "↓") : ""}
            </th>
            <th className="px-1 py-0 cursor-pointer text-right" onClick={() => handleSort("distance")}>
              種目 {sortKey === "distance" ? (sortAsc ? "↑" : "↓") : ""}
            </th>
            <th className="px-1 py-0 cursor-pointer text-center" onClick={() => handleSort("date")}>
              日付 {sortKey === "date" ? (sortAsc ? "↑" : "↓") : ""}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
              {sortedRecords.map((r, index) => (
                <tr key={r.id}>
                  <td className="px-1 md:px-3 py-0 text-right">{index + 1}.</td>
                  <td className="px-1 md:px-3 py-0 text-right">
                    {formatTime(r.time_ms)}
                  </td>
                  <td className="px-1 md:px-3 py-0">{r.comment}</td>
                  <td className="px-1 md:px-3 py-0 text-right">{r.race_name} </td>
                  <td className="px-1 md:px-3 py-0 text-right">{Math.abs(r.distance - 42.195) < 0.001
                    ? "フル"
                    : Math.abs(r.distance - 21.0975) < 0.001
                      ? "ハーフ"
                      : `${r.distance} km`}
                  </td>
                  <td className="px-1 md:px-3 py-0">{r.date.substring(0, 4)}/{r.date.substring(5, 7)}/{r.date.substring(8, 10)}</td>
                </tr>
              ))}
            </tbody>
      </table>
    </div>
  )
}
