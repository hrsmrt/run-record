"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

type Record = {
  id: number
  name: string
  time_ms: number
  race_name: string
  distance: number
  race_type: string
  date: string
  gender?: string
  comment?: string
}

type Props = {
  raceType: "all" | "road" | "trail" | "track" | "time"
  distance: "all" | "5km" | "10km" | "ハーフマラソン" | "フルマラソン" | "100km" | "その他(100km未満)" | "その他(100km以上)"
  view: "all" | "best"
  genderFilter: "all" | "male" | "female"
}

type SortKey = keyof Record

export default function RecordTable({ raceType, distance, view, genderFilter }: Props) {
  const [records, setRecords] = useState<Record[]>([])
  const [sortKey, setSortKey] = useState<SortKey>("date")
  const [sortAsc, setSortAsc] = useState(false)

  useEffect(() => {
    const fetchRecords = async () => {
      const supabase = createClient()
      let query;
      if (view === "all") {
        if (distance === "5km") {
          query = supabase.from("public_5");
        } else if (distance === "10km") {
          query = supabase.from("public_10");
        } else if (distance === "ハーフマラソン") {
          query = supabase.from("public_half");
        } else if (distance === "フルマラソン") {
          query = supabase.from("public_full");
        } else if (distance === "100km") {
          query = supabase.from("public_100");
        } else if (distance === "その他(100km未満)") {
          query = supabase.from("public_others_under100");
        } else if (distance === "その他(100km以上)") {
          query = supabase.from("public_others_over100");
        } else {
          query = supabase.from("public_record");
        }
      } else {
        if (distance === "5km") {
          query = supabase.from("public_5_best");
        } else if (distance === "10km") {
          query = supabase.from("public_10_best");
        } else if (distance === "ハーフマラソン") {
          query = supabase.from("public_half_best");
        } else if (distance === "フルマラソン") {
          query = supabase.from("public_full_best");
        } else if (distance === "100km") {
          query = supabase.from("public_100_best");
        } else {
          query = supabase.from("public_record_best");
        }
      }
      query = query.select("*");
      // race_type 絞り込み
      if (raceType !== "all") {
        query = query.eq("race_type", raceType)
      }
      if (genderFilter !== "all") {
        query = query.eq("gender", genderFilter)
      }
      const { data, error } = await query;
      if (error) {
        console.error(error)
      } else {
        setRecords(data ?? [])
      }
    }
    fetchRecords()
  }, [raceType, distance, view, genderFilter])

  const sortedRecords = [...records]
    .sort((a, b) => {
      const valA = a[sortKey]
      const valB = b[sortKey]
      if (valA === valB) return 0
      if (valA === null || valA === undefined) return 1
      if (valB === null || valB === undefined) return -1
      return sortAsc ? (valA > valB ? 1 : -1) : valA > valB ? -1 : 1
    })

  // ソート用関数
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  return (
    <div className="bg-white w-full text-black p-2">
      <div className="text-gray-500 mb-2 text-sm">
        ラベルをタップすることで並び替えできます
      </div>
      <div className="overflow-x-auto flex justify-center">
        <div className="min-w-[600px]">
          <table className="table-auto border-collapse w-full text-black bg-white">
            <thead>
              <tr className="bg-white">
                <th className="px-4 py-2">#</th>
                <th
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleSort("name")}
                >
                  名前 {sortKey === "name" ? (sortAsc ? "↑" : "↓") : ""}
                </th>
                <th
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleSort("time_ms")}
                >
                  記録 {sortKey === "time_ms" ? (sortAsc ? "↑" : "↓") : ""}
                </th>
                <th
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleSort("race_name")}
                >
                  大会 {sortKey === "race_name" ? (sortAsc ? "↑" : "↓") : ""}
                </th>
                <th
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleSort("distance")}
                >
                  距離 {sortKey === "distance" ? (sortAsc ? "↑" : "↓") : ""}
                </th>
                <th
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleSort("race_type")}
                >
                  分類 {sortKey === "race_type" ? (sortAsc ? "↑" : "↓") : ""}
                </th>
                <th
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleSort("date")}
                >
                  日付 {sortKey === "date" ? (sortAsc ? "↑" : "↓") : ""}
                </th>
                <th
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleSort("comment")}
                >
                  コメント {sortKey === "comment" ? (sortAsc ? "↑" : "↓") : ""}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRecords.map((r, index) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 text-center">{index + 1}</td>
                  <td className={`px-4 py-2 ${r.gender === "female" ? "text-red-600" : "text-black"}`}>
                    {r.name}
                  </td>
                  <td className="px-4 py-2">
                    {Math.floor(r.time_ms / 3600000)}:
                    {Math.floor((r.time_ms % 3600000) / 60000)}:
                    {Math.floor((r.time_ms % 60000) / 1000)}
                  </td>
                  <td className="px-4 py-2">{r.race_name}</td>
                  <td className="px-4 py-2">{r.distance} km</td>
                  <td className="px-4 py-2">{r.race_type}</td>
                  <td className="px-4 py-2">{r.date}</td>
                  <td className="px-4 py-2">{r.comment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
