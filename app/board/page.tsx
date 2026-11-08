import { BoardList } from "@/components/BoardList"

export default function BoardPage() {
  return (
    <main className="min-h-screen flex flex-col items-center p-4">
      <div className="flex-1 w-full flex flex-col gap-4">
        <h1 className="text-lg font-bold max-w-4xl w-full mx-auto">掲示板</h1>
        <BoardList />
      </div>
    </main>
  )
}
