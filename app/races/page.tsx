import { Suspense } from "react"
import { RaceHistory } from "@/components/RaceHistory"

export default function RacesPage() {
  return (
    <main className="min-h-screen flex flex-col items-center p-4">
      <div className="flex-1 w-full flex flex-col gap-4">
        <h1 className="text-lg font-bold max-w-5xl w-full mx-auto">出場大会記録</h1>
        {/* 絞り込み条件を URL から読むため（useSearchParams） */}
        <Suspense fallback={<p className="text-sm max-w-5xl w-full mx-auto">読み込み中...</p>}>
          <RaceHistory />
        </Suspense>
      </div>
    </main>
  )
}
