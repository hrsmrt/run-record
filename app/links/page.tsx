"use client"

import { ExternalLink } from "lucide-react"

// リンクの型定義
type LinkItem = {
  id: number
  title: string
  url: string
  description: string
}

export default function LinksPage() {
  // 後でリンクを追加する場所
  const links: LinkItem[] = [
    // 例:
    // {
    //   id: 1,
    //   title: "サンプルブログ",
    //   url: "https://example.com",
    //   description: "ランニングに関する参考になるブログです。"
    // }
    {
      id: 1,
      title: "ホノルルマラソンを走る会",
      url: "http://www.honomara.net/",
      description: "インカレランニングサークルのホノルルマラソンを走る会の公式サイトです。"
    },
    {
      id: 2,
      title: "大会録",
      url: "https://ameblo.jp/honomara2025/",
      description: "ホノルルマラソンを走る会のメンバーが大会参加記録を綴ったブログです。"
    }
  ]

  return (
    <main className="min-h-screen flex flex-col items-center p-4">
      <div className="w-full max-w-4xl flex flex-col gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">リンク集</h1>
        </div>
        {links.length > 0 ? (
          <div className="grid gap-4">
            {links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
                      {link.title}
                      <ExternalLink size={16} className="text-gray-400" />
                    </h2>
                    <p className="text-gray-600 mb-2">{link.description}</p>
                    <p className="text-sm text-blue-600">{link.url}</p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p>リンクはまだ追加されていません。</p>
          </div>
        )}
      </div>
    </main>
  )
}
