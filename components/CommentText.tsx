import { ReactNode } from "react"
import { ExternalLink } from "lucide-react"

// Markdown形式のリンク [テキスト](URL) をパースする関数
export const parseComment = (text: string | undefined | null) => {
  if (!text) return null

  // Markdown形式のリンクを検出する正規表現: [テキスト](URL)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  const parts: (string | ReactNode)[] = []
  let lastIndex = 0
  let match
  let key = 0

  while ((match = linkRegex.exec(text)) !== null) {
    // リンクの前のテキストを追加
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index))
    }

    // リンクを追加（http/https 以外の URL はリンクにせずテキストのまま表示）
    const linkText = match[1]
    const url = match[2]
    if (!/^https?:\/\//i.test(url)) {
      parts.push(match[0])
      lastIndex = linkRegex.lastIndex
      continue
    }
    parts.push(
      <a
        key={key++}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline inline-flex items-center gap-1"
      >
        {linkText}
        <ExternalLink size={12} className="inline" />
      </a>
    )

    lastIndex = linkRegex.lastIndex
  }

  // 最後のリンクの後のテキストを追加
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }

  // パースした結果がない場合は元のテキストを返す
  return parts.length > 0 ? parts : text
}
