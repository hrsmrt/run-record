"use client"

import { useState } from "react"
import RecordTable from "@/components/RecordTable"

type RaceType = "all" | "road" | "trail" | "track" | "time";
type DistanceType = "all" | "5km" | "10km" | "ハーフマラソン" | "フルマラソン" | "100km" | "その他(100km未満)" | "その他(100km以上)";
type ViewType = "all" | "best";
type GenderType = "all" | "male" | "female";


export default function Home() {
  const [raceType, setRaceType] = useState<"all" | "road" | "trail" | "track" | "time">("all")
  const [distance, setDistance] = useState<"all" | "5km" | "10km" | "ハーフマラソン" | "フルマラソン" | "100km" | "その他(100km未満)" | "その他(100km以上)">("all")
  const [view, setView] = useState<"all" | "best">("all")
  const [gender, setGenderFilter] = useState<"all" | "male" | "female">("all")

  return (
    <main className="min-h-screen flex flex-col items-center p-4">
  <div className="flex-1 w-full flex flex-col gap-4">

    {/* フィルター部分 */}
    <div className="flex flex-row md:flex-row flex-wrap gap-4 mb-4 w-full text-[12px] lg:text-xl">
      <div className="flex-1 min-w-[80px] md:max-w-[200px]">
            <label className="mr-2 font-medium">種別:</label>
            <select
              value={raceType}
              onChange={e => setRaceType(e.target.value as RaceType)}
              className="w-full border px-2 py-1 rounded"
            >
              <option value="all">All</option>
              <option value="road">Road</option>
              <option value="trail">Trail</option>
              <option value="track">Track</option>
              <option value="time">Time</option>
            </select>
          </div>

          <div className="flex-1 min-w-[80px]">
            <label className="mr-2 font-medium">距離:</label>
            <select
              value={distance}
              onChange={e => setDistance(e.target.value as DistanceType)}
              className="w-full border px-2 py-1 rounded"
            >
              <option value="all">All</option>
              <option value="5km">5km</option>
              <option value="10km">10km</option>
              <option value="ハーフマラソン">ハーフマラソン</option>
              <option value="フルマラソン">フルマラソン</option>
              <option value="100km">100km</option>
              <option value="その他(100km未満)">その他(100km未満)</option>
              <option value="その他(100km以上)">その他(100km以上)</option>
            </select>
          </div>

          <div className="flex-1 min-w-[80px]">
            <label className="mr-2 font-medium">全てorベスト</label>
            <select
              value={view}
              onChange={e => setView(e.target.value as ViewType)}
              className="w-full border px-2 py-1 rounded"
            >
              <option value="all">All</option>
              <option value="best">Best</option>
            </select>
          </div>

          <div className="flex-1 min-w-[40px]">
            <label className="mr-2 font-medium">性別</label>
            <select
              value={gender}
              onChange={e => setGenderFilter(e.target.value as GenderType)}
              className="w-full border px-2 py-1 rounded"
            >
              <option value="all">All</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
        </div>

        {/* RecordTableにフィルター値を渡す */}
        <RecordTable
          raceType={raceType}
          distance={distance}
          view={view}
          genderFilter={gender}
        />
      </div>
    </main>
  )
}
