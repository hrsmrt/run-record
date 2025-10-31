"use client"

import { useState, useEffect } from "react"
import RecordTable from "@/components/RecordTable"

type ViewType = "all" | "best";
type GenderType = "all" | "male" | "female";
type EventType = "all" | "full" | "half" | "10km" | "5km" | "100km" | "その他(100km未満)" | "その他(100km以上)" | "trail";
type RaceType = "all" | "road" | "trail" | "track" | "time";


export default function SearchPage() {
  const [event, setEvent] = useState<EventType>("all");
  const [distance, setDistance] = useState<string>("all")  // ← stateで管理
  const [raceType, setRaceType] = useState<RaceType>("all")
  const [view, setView] = useState<ViewType>("all")
  const [gender, setGenderFilter] = useState<GenderType>("all")
  const [minDate, setMinDate] = useState<string>("1900-01-01")
  const [maxDate, setMaxDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [show_distance, setShow_distance] = useState(false)
  const [racenameSearch, setRacenameSearch] = useState<string>("")
  const [nameSearch, setNameSearch] = useState<string>("")
  const [searchTrigger, setSearchTrigger] = useState(0);
  const [year, setYear] = useState<string>("")

  useEffect(() => {
    if (event === "all") {
      setDistance("all")
      setRaceType("all")
    } else if (event === "trail") {
      setDistance("all")
      setRaceType("trail")
    } else {
      setDistance(event)
      setRaceType("all")
    }
    if (event === "all" || event === "その他(100km未満)" || event === "その他(100km以上)") {
      setShow_distance(true)
    } else {
      setShow_distance(false)
    }
  }, [event])
  useEffect(() => {
    if (year !== "") {
      setMinDate(`${year}-01-01`)
      setMaxDate(`${year}-12-31`)
    }
  }, [year])

  return (
    <main className="min-h-screen flex flex-col items-center p-4">
      <div className="flex-1 w-full flex flex-col gap-4">
        検索ページ
        {/* フィルター部分 */}
        <div className="flex flex-col md:flex-row flex-wrap gap-4 mb-4 w-full text-base lg:text-lg">

          <div className="flex-1 min-w-[80px] max-w-[200px]">
            <select
            value={event}
            onChange={e => setEvent(e.target.value as EventType)}
            className="w-full border px-2 py-1 rounded"
          >
            <option value="all">全種目</option>
            <option value="full">フルマラソン</option>
            <option value="half">ハーフマラソン</option>
            <option value="10km">10キロ</option>
            <option value="5km">5キロ</option>
            <option value="100km">100キロ</option>
            <option value="その他(100km未満)">その他(100km未満)</option>
            <option value="その他(100km以上)">その他(100km以上)</option>
            <option value="trail">トレイル</option>
          </select>
          </div>
          {raceType !== "trail" && distance !== "all" && (
          <>
          <div className="flex-1 min-w-[80px] max-w-[200px]">
            <select
              value={view}
              onChange={e => setView(e.target.value as ViewType)}
              className="w-full border px-2 py-1 rounded"
            >
              <option value="all">全記録</option>
              <option value="best">ベスト記録のみ</option>
            </select>
          </div>
          </>
          )}
            {raceType !== "trail" && (
          <>
          <div className="flex-1 min-w-[40px] max-w-[200px]">
            <select
              value={gender}
              onChange={e => setGenderFilter(e.target.value as GenderType)}
              className="w-full border px-2 py-1 rounded"
            >
              <option value="all">総合</option>
              <option value="male">男子</option>
              <option value="female">女子</option>
            </select>
          </div>
          </>
          )}
          <div className="flex-1 min-w-[40px] max-w-[200px]">
            <input
              type="text"
              value={racenameSearch}
              onChange={e => setRacenameSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setSearchTrigger(prev => prev + 1);  // 検索トリガーを変更
                }
              }}
              className="w-full border px-2 py-1 rounded"
              placeholder="大会名"
            />
          </div>
          <div className="flex-1 min-w-[40px] max-w-[200px]">
            <input
              type="text"
              value={nameSearch}
              onChange={e => setNameSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setSearchTrigger(prev => prev + 1);  // 検索トリガーを変更
                }
              }}
              className="w-full border px-2 py-1 rounded"
              placeholder="名前"
            />
          </div>
          <div className="flex-1 min-w-[40px] max-w-[200px]">
            <input
              type="text"
              value={year}
              onChange={e => setYear(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setSearchTrigger(prev => prev + 1);  // 検索トリガーを変更
                }
              }}
              className="w-full border px-2 py-1 rounded"
              placeholder="年"
            />
          </div>
        </div>

        {/* RecordTableにフィルター値を渡す */}
        <RecordTable
          view={view}
          genderFilter={gender}
          distance={distance}
          show_distance={show_distance}
          raceType={raceType}
          date_min={minDate}
          date_max={maxDate}
          racenameSearch={racenameSearch}
          nameSearch={nameSearch}
          searchTrigger={searchTrigger}
        />
      </div>
    </main>
  )
}
