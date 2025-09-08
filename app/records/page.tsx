"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

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
    <div className="max-w-4xl mx-auto p-4">
      {/* 絞り込みUI */}
      <div className="flex gap-4 mb-4">
        <select
          value={distanceFilter}
          onChange={(e) => setDistanceFilter(e.target.value)}
          className="border px-2 py-1 rounded"
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
          className="border px-2 py-1 rounded"
        >
          <option value="all">分類: 全て</option>
          <option value="road">ロード</option>
          <option value="trail">トレイル</option>
          <option value="track">トラック</option>
          <option value="time">時間走</option>
        </select>
      </div>

      <table className="w-full table-auto text-left">
        <thead>
          <tr>
            <th className="px-2 py-1 cursor-pointer" onClick={() => handleSort("time_ms")}>
              時間 {sortKey === "time_ms" ? (sortAsc ? "↑" : "↓") : ""}
            </th>
            <th className="px-2 py-1 cursor-pointer" onClick={() => handleSort("race_name")}>
              大会 {sortKey === "race_name" ? (sortAsc ? "↑" : "↓") : ""}
            </th>
            <th className="px-2 py-1 cursor-pointer" onClick={() => handleSort("distance")}>
              距離 {sortKey === "distance" ? (sortAsc ? "↑" : "↓") : ""}
            </th>
            <th className="px-2 py-1 cursor-pointer" onClick={() => handleSort("race_type")}>
              分類 {sortKey === "race_type" ? (sortAsc ? "↑" : "↓") : ""}
            </th>
            <th className="px-2 py-1 cursor-pointer" onClick={() => handleSort("date")}>
              日付 {sortKey === "date" ? (sortAsc ? "↑" : "↓") : ""}
            </th>
            <th className="px-2 py-1 cursor-pointer" onClick={() => handleSort("comment")}>
              コメント {sortKey === "comment" ? (sortAsc ? "↑" : "↓") : ""}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRecords.map((record) => (
            <tr key={record.id}>
              <td className="px-2 py-1">
                {Math.floor(record.time_ms / 3600000)}:
                {Math.floor((record.time_ms % 3600000) / 60000)}:
                {Math.floor((record.time_ms % 60000) / 1000)}
              </td>
              <td className="px-2 py-1">{record.race_name}</td>
              <td className="px-2 py-1">{record.distance} km</td>
              <td className="px-2 py-1">{record.race_type}</td>
              <td className="px-2 py-1">{record.date}</td>
              <td className="px-2 py-1">{record.comment}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
