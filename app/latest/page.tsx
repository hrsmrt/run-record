"use client"

import RecordTable from "@/components/RecordTable"
import { getOneYearAgoDateFormatted } from "@/lib/utils"

export default function Home() {

  return (
    <main className="min-h-screen flex flex-col items-center p-4">
      <div className="flex-1 w-full flex flex-col gap-4">
        {/* RecordTableにフィルター値を渡す */}
        最近の記録
        <RecordTable
          raceType={"all"}
          distance={"all"}
          show_distance={true}
          view={"all"}
          genderFilter={"all"}
          date_min={getOneYearAgoDateFormatted()}
          date_max={"9999-12-31"}
          racenameSearch={""}
          nameSearch={""}
          searchTrigger={0}
        />
      </div>
    </main>
  )
}
