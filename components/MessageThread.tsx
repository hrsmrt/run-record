"use client"

import { useState } from "react"
import { LinkifiedText } from "@/components/CommentText"
import { EnrollmentTag } from "@/components/EnrollmentTag"

export type ThreadMessage = {
    id: number
    author_name: string | null
    author_gender: string | null
    author_enrollment_year: number | null
    body: string
    created_at: string
    updated_at: string
    is_mine: boolean
}

// 書き込んだ日時（ブラウザのタイムゾーン）
export const formatDateTime = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

// やりとりの一覧と書き込み欄（古い順）。保存・削除は親が行い、失敗したらエラー文を返す
export function MessageThread({ messages, canPost, maxLength, placeholder, onPost, onUpdate, onDelete, canDeleteAny }: {
    messages: ThreadMessage[]
    canPost: boolean
    maxLength: number
    placeholder: string
    onPost: (body: string) => Promise<string | null>
    onUpdate: (id: number, body: string) => Promise<string | null>
    onDelete: (id: number) => Promise<string | null>
    // 管理者は他人の書き込みも消せる
    canDeleteAny?: boolean
}) {
    const [draft, setDraft] = useState("")
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editDraft, setEditDraft] = useState("")
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")

    const run = async (action: () => Promise<string | null>, after: () => void) => {
        setBusy(true)
        setError("")
        const err = await action()
        setBusy(false)
        if (err) { setError(err); return }
        after()
    }

    const handlePost = () => {
        if (draft.trim() === "") { setError("内容を入力してください"); return }
        run(() => onPost(draft), () => setDraft(""))
    }

    return (
        <div className="flex flex-col gap-2 text-sm">
            {messages.length === 0 && <p className="text-gray-500">まだ書き込みはありません。</p>}
            {messages.map(m => (
                <article key={m.id} className="bg-white p-2 border rounded">
                    <header className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`font-bold ${m.author_gender === "female" ? "text-red-600" : ""}`}>
                            {m.author_name ?? "（退会したメンバー）"}<EnrollmentTag year={m.author_enrollment_year} />
                        </span>
                        <span className="text-xs text-gray-500">
                            {formatDateTime(m.created_at)}{m.updated_at > m.created_at && "（編集済み）"}
                        </span>
                        {m.is_mine && editingId !== m.id && (
                            <button onClick={() => { setEditingId(m.id); setEditDraft(m.body) }} className="text-xs text-blue-600 hover:underline">編集</button>
                        )}
                        {(m.is_mine || canDeleteAny) && editingId !== m.id && (
                            <button
                                onClick={() => confirm("この書き込みを削除しますか？") && run(() => onDelete(m.id), () => {})}
                                className="text-xs text-red-600 hover:underline"
                            >
                                削除
                            </button>
                        )}
                    </header>
                    {editingId === m.id ? (
                        <div className="flex flex-col gap-1">
                            <textarea value={editDraft} maxLength={maxLength} onChange={e => setEditDraft(e.target.value)} rows={3} className="w-full border rounded p-2 bg-white" />
                            <div className="flex gap-3">
                                <button
                                    onClick={() => editDraft.trim() === "" ? setError("内容を入力してください") : run(() => onUpdate(m.id, editDraft), () => setEditingId(null))}
                                    disabled={busy}
                                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-xs"
                                >
                                    保存
                                </button>
                                <button onClick={() => setEditingId(null)} className="text-xs text-gray-600 hover:underline">やめる</button>
                            </div>
                        </div>
                    ) : (
                        <LinkifiedText text={m.body} />
                    )}
                </article>
            ))}
            {canPost && (
                <div className="flex flex-col gap-1">
                    <textarea value={draft} maxLength={maxLength} onChange={e => setDraft(e.target.value)} rows={3} placeholder={placeholder} className="w-full border rounded p-2 bg-white" />
                    <div className="flex items-center gap-3">
                        <button onClick={handlePost} disabled={busy} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-xs">
                            {busy ? "送信中..." : "書き込む"}
                        </button>
                        <span className="ml-auto text-xs text-gray-500">{draft.length} / {maxLength}</span>
                    </div>
                </div>
            )}
            {error && <p className="text-red-600">{error}</p>}
        </div>
    )
}
