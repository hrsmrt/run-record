"use client"

import { Fragment, useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { type ResultStatus, compareResult, formatResult, isFinished } from "@/lib/result-status"
import Link from "next/link"
import { SplitTableLoader } from "@/components/SplitTable"
import { parseComment } from "@/components/CommentText"
import { EnrollmentTag } from "@/components/EnrollmentTag"

type RaceRecord = {
  id: number
  name: string
  time_ms: number | null
  status: ResultStatus
  dnf_km: number | null
  race_name: string
  distance: number
  date: string
  gender?: string
  comment?: string
  event_id: number | null
  clever_index: number | null
  has_splits: boolean
  enrollment_year: number | null
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
  enrollmentYear: string
  searchTrigger: number
}

type SortKey = keyof RaceRecord

export default function RecordTable({ view, genderFilter, distance, raceType, date_min, date_max, show_distance, racenameSearch, nameSearch, enrollmentYear, searchTrigger }: Props) {
  const [records, setRecords] = useState<RaceRecord[]>([])
  const [sortKey, setSortKey] = useState<SortKey>("date")
  const [sortAsc, setSortAsc] = useState(false)
  const [openSplitId, setOpenSplitId] = useState<number | null>(null)

  useEffect(() => {
    const fetchRecords = async () => {
      const supabase = createClient()
      // public_results の category（距離区分）に対応。その他は時間走も距離で振り分ける
      const categoryFilter: Record<string, string> = {
        "5km": "category.eq.5km",
        "10km": "category.eq.10km",
        "half": "category.eq.half",
        "full": "category.eq.full",
        "100km": "category.eq.100km",
        "その他(100km未満)": "category.eq.under100,and(category.eq.time,distance.lt.100)",
        "その他(100km以上)": "category.eq.over100,and(category.eq.time,distance.gt.100)",
      };
      let query = supabase.from("public_results").select("*");
      const filter = categoryFilter[distance]
      if (filter) {
        query = query.or(filter)
        // その他はベスト表示の対象外（距離がばらばらのため）
        if (view === "best" && !distance.startsWith("その他")) {
          query = query.eq("is_best", true)
        }
      } else if (view === "best" && raceType !== "trail") {
        // 全種目のベストは、メンバーごと・距離区分ごとに1件（トレイルは選択欄を出さないので対象外）。
        // 距離がばらばらのその他と、時間がばらばらの時間走は除く
        query = query.eq("is_best", true).not("category", "in", "(under100,over100,time)")
      }
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
      if (/^\d{4}$/.test(enrollmentYear)) {
        query = query.eq("enrollment_year", Number(enrollmentYear))
      }
      const { data, error } = await query;
      if (error) {
        console.error("Supabase error:", JSON.stringify(error, null, 2))
      } else {
        setRecords(data ?? [])
      }
    }
    fetchRecords()
  }, [view, distance, genderFilter, raceType, date_min, date_max, racenameSearch, nameSearch, enrollmentYear, searchTrigger])

  const sortedRecords = [...records]
    .sort((a, b) => {
      // 記録順: 完走以外（DNF・DNS など）は向きに関係なく下にまとめる
      if (sortKey === "time_ms") {
        if (!isFinished(a) || !isFinished(b)) return compareResult(a, b)
        return sortAsc ? a.time_ms! - b.time_ms! : b.time_ms! - a.time_ms!
      }
      const valA = a[sortKey]
      const valB = b[sortKey]
      if (valA === valB) {
        // 日付順のときは、同じ日の中で大会ごとにまとめ、大会内は距離の長い順・タイム順
        if (sortKey === "date") {
          return a.race_name.localeCompare(b.race_name) || b.distance - a.distance || compareResult(a, b)
        }
        return 0
      }
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
      // クレバー指数は高いほど良いので、最初は高い順（降順）
      setSortAsc(key !== "clever_index")
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
                  className="px-1 md:px-3 py-0 cursor-pointer w-[14%] md:w-[9%] lg:w-[7%]"
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
                  className="px-1 md:px-3 py-0 cursor-pointer w-[10%] lg:w-[6%]"
                  onClick={() => handleSort("clever_index")}
                  title="RUNNET のクレバー指数"
                >
                  クレバー {sortKey === "clever_index" ? (sortAsc ? "↑" : "↓") : ""}
                </th>
                <th className="px-1 md:px-3 py-0 w-[9%] lg:w-[5%]">ラップ</th>
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
                <Fragment key={r.id}>
                <tr>
                  <td className="px-1 md:px-3 py-0 text-right">{index + 1}.</td>
                  {/* 狭い画面では入学年度が次の行に回るよう折り返しを許す（隣の列に重ならないように） */}
                  <td className={`px-1 md:px-3 py-0 whitespace-normal break-words ${r.gender === "female" ? "text-red-600" : "text-black"}`}>
                    {r.name}<EnrollmentTag year={r.enrollment_year} />
                  </td>
                  <td className="px-1 md:px-3 py-0 text-right">
                    {formatResult(r)}
                  </td>
                  <td className="px-1 md:px-3 py-0 text-right whitespace-normal">
                    {r.event_id != null
                      ? <Link href={`/event/${r.event_id}`} className="text-blue-600 hover:underline">{r.race_name}</Link>
                      : r.race_name}
                  </td>
                  {show_distance === true && (
                  <td className="px-1 md:px-3 py-0 text-right">{Math.abs(r.distance - 42.195) < 0.001
                    ? "フル"
                    : Math.abs(r.distance - 21.0975) < 0.001
                      ? "ハーフ"
                      : `${r.distance} km`}
                  </td>)}
                  <td className="px-1 md:px-3 py-0">{r.date.substring(0, 4)}/{r.date.substring(5, 7)}/{r.date.substring(8, 10)}</td>
                  <td className="px-1 md:px-3 py-0 text-right">{r.clever_index ?? ""}</td>
                  <td className="px-1 md:px-3 py-0 text-center">
                    {r.has_splits && (
                      <button
                        onClick={() => setOpenSplitId(openSplitId === r.id ? null : r.id)}
                        className="text-blue-600 hover:underline"
                        aria-expanded={openSplitId === r.id}
                      >
                        {openSplitId === r.id ? "閉じる" : "表示"}
                      </button>
                    )}
                  </td>
                  <td className="px-1 md:px-3 py-0 whitespace-normal">
                    {parseComment(r.comment)}
                  </td>
                </tr>
                {openSplitId === r.id && (
                  <tr>
                    <td colSpan={show_distance === true ? 9 : 8} className="px-1 md:px-3 pb-2">
                      <SplitTableLoader resultId={r.id} />
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
