"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { formatTime } from "@/lib/utils"

type RaceRecord = {
  id: number
  name: string
  time_ms: number
  race_name: string
  distance: number
  date: string
  gender?: string
  comment?: string
}

type Props = {
  view: "all" | "best"
  genderFilter: "all" | "male" | "female"
  distance: string
  raceType: "all" | "road" | "trail" | "track" | "time"
  date_min: string
  date_max: string
  show_distance?: boolean
  racenameSearch: string
  nameSearch: string
  searchTrigger: number
}

type SortKey = keyof RaceRecord

export default function RecordTable({ view, genderFilter, distance, raceType, date_min, date_max, show_distance, racenameSearch, nameSearch, searchTrigger }: Props) {
  const [records, setRecords] = useState<RaceRecord[]>([])
  const [sortKey, setSortKey] = useState<SortKey>("date")
  const [sortAsc, setSortAsc] = useState(false)

  useEffect(() => {
    const fetchRecords = async () => {
      const supabase = createClient()
      const tableMap: Record<
        "5km" | "10km" | "half" | "full" | "100km" | "その他(100km未満)" | "その他(100km以上)" | "all",
        string
      > = {
        "5km": view === "all" ? "public_5" : "public_5_best",
        "10km": view === "all" ? "public_10" : "public_10_best",
        "half": view === "all" ? "public_half" : "public_half_best",
        "full": view === "all" ? "public_full" : "public_full_best",
        "100km": view === "all" ? "public_100" : "public_100_best",
        "その他(100km未満)": "public_others_under100",
        "その他(100km以上)": "public_others_over100",
        "all": view === "all" ? "public_record" : "public_record_best"
      };
      const tableName = tableMap[distance as keyof typeof tableMap] || "public_record";
      let query = supabase.from(tableName).select("*");
      if (date_min !== "") {
        query = query.gt("date", date_min)
      }
      if (date_max !== "") {
        query = query.lt("date", date_max)
      }
      if (raceType !== "all") {
        query = query.eq("race_type", raceType)
      }
      if (genderFilter !== "all") {
        query = query.eq("gender", genderFilter)
      }
      if (racenameSearch !== "") {
        query = query.ilike("race_name", `%${racenameSearch}%`)
      }
      if (nameSearch !== "") {
        query = query.ilike("name", `%${nameSearch}%`) // 匿名を含む名前のみ
      }
      const { data, error } = await query;
      if (error) {
        console.error("Supabase error:", JSON.stringify(error, null, 2))
      } else {
        setRecords(data ?? [])
      }
    }
    fetchRecords()
  }, [view, distance, genderFilter, raceType, date_min, date_max, racenameSearch, nameSearch, searchTrigger])

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
    <div className="bg-white w-full text-black p-2 text-[8px] md:text-base whitespace-nowrap">
      <div className="text-gray-500 mb-2 text-[7px] sm:text-xs md:text-sm">
        ラベルをクリックすることで並び替えできます
      </div>
      <div className="overflow-x-auto flex justify-start md:justify-center">
        <div className="min-w-[450px] max-w-[1300px]">
          <table className="table-fixed border-collapse w-full text-black bg-white font-mono mb-6">
            <thead>
              <tr className="bg-white">
                <th className="px-1 md:px-3 py-0 w-[6%] lg:w-[4%]"></th>
                <th
                  className="px-1 md:px-3 py-0 cursor-pointer w-[6%] lg:w-[4%]" 
                  onClick={() => handleSort("name")}
                >
                  名前 {sortKey === "name" ? (sortAsc ? "↑" : "↓") : ""}
                </th>
                <th
                  className="px-1 md:px-3 py-0 cursor-pointer w-[13%] lg:w-[8%]"
                  onClick={() => handleSort("time_ms")}
                >
                  記録 {sortKey === "time_ms" ? (sortAsc ? "↑" : "↓") : ""}
                </th>
                <th
                  className="px-1 md:px-3 py-0 cursor-pointer w-[20%]"
                  onClick={() => handleSort("race_name")}
                >
                  大会 {sortKey === "race_name" ? (sortAsc ? "↑" : "↓") : ""}
                </th>
                {show_distance === true && (
                  <th
                  className="px-1 md:px-3 py-0 cursor-pointer w-[12%] lg:w-[6%]"
                  onClick={() => handleSort("distance")}
                >
                  種目 {sortKey === "distance" ? (sortAsc ? "↑" : "↓") : ""}
                </th>)}
                <th
                  className="px-1 md:px-3 py-0 cursor-pointer w-[16%] lg:w-[8%]"
                  onClick={() => handleSort("date")}
                >
                  日付 {sortKey === "date" ? (sortAsc ? "↑" : "↓") : ""}
                </th>
                <th
                  className="px-1 md:px-3 py-0 cursor-pointer w-[18%]"
                  onClick={() => handleSort("comment")}
                >
                  備考 {sortKey === "comment" ? (sortAsc ? "↑" : "↓") : ""}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedRecords.map((r, index) => (
                <tr key={r.id}>
                  <td className="px-1 md:px-3 py-0 text-right">{index + 1}.</td>
                  <td className={`px-1 md:px-3 py-0 ${r.gender === "female" ? "text-red-600" : "text-black"}`}>
                    {r.name}
                  </td>
                  <td className="px-1 md:px-3 py-0 text-right">
                    {formatTime(r.time_ms)}
                  </td>
                  <td className="px-1 md:px-3 py-0 text-right whitespace-normal">{r.race_name} </td>
                  {show_distance === true && (
                  <td className="px-1 md:px-3 py-0 text-right">{Math.abs(r.distance - 42.195) < 0.001
                    ? "フル"
                    : Math.abs(r.distance - 21.0975) < 0.001
                      ? "ハーフ"
                      : `${r.distance} km`}
                  </td>)}
                  <td className="px-1 md:px-3 py-0">{r.date.substring(0, 4)}/{r.date.substring(5, 7)}/{r.date.substring(8, 10)}</td>
                  <td className="px-1 md:px-3 py-0 whitespace-normal">{r.comment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
