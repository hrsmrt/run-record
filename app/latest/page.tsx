import { LatestByRace } from "@/components/LatestByRace"

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center p-4">
      <div className="flex-1 w-full flex flex-col gap-4">
        <h1 className="text-lg font-bold max-w-4xl w-full mx-auto">最近の記録</h1>
        <LatestByRace />
      </div>
    </main>
  )
}
