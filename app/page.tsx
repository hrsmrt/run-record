"use client"

import Link from "next/link"
import { Clock, Search, Link as LinkIcon } from "lucide-react"

export default function Home() {
  const pages = [
    {
      id: 1,
      title: "最新の記録",
      description: "直近1年間のマラソン大会結果を閲覧できます",
      href: "/latest",
      icon: Clock,
    },
    {
      id: 2,
      title: "検索",
      description: "大会名、ランナー名、日付などで記録を検索できます",
      href: "/search",
      icon: Search,
    },
    {
      id: 3,
      title: "リンク集",
      description: "関連サイトのリンク集です",
      href: "/links",
      icon: LinkIcon,
    },
  ]

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl flex flex-col gap-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Runner's Record</h1>
          <p className="text-gray-600">マラソン等大会結果記録・共有ツール</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {pages.map((page) => (
            <Link
              key={page.id}
              href={page.href}
              className="block p-6 border rounded-lg hover:bg-gray-50 hover:shadow-lg transition-all"
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div className="p-4 bg-blue-100 rounded-full">
                  <page.icon size={32} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold mb-2">{page.title}</h2>
                  <p className="text-sm text-gray-600">{page.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
