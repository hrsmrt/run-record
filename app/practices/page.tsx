import { PracticeList } from "@/components/PracticeList"

export default function PracticesPage() {
  return (
    <main className="min-h-screen flex flex-col items-center p-4">
      <div className="flex-1 w-full flex flex-col gap-4">
        <h1 className="text-lg font-bold max-w-5xl w-full mx-auto">練習録</h1>
        <PracticeList />
      </div>
    </main>
  )
}
