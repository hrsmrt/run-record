import { HomeFeed } from "@/components/HomeFeed"

// ホーム: 練習予定・掲示板・大会の記録と練習録を表示する（各ページへはヘッダーのメニューから）
export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center p-4">
      <div className="flex-1 w-full flex flex-col gap-4">
        <div className="max-w-4xl w-full mx-auto">
          <h1 className="text-lg font-bold">Runner&apos;s Record</h1>
          <p className="text-xs text-gray-500">ホノマラOBOG向け記録共有サイト（非公式）</p>
        </div>
        <HomeFeed />
      </div>
    </main>
  )
}
