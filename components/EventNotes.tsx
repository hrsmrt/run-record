"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { LinkifiedText } from "@/components/CommentText"
import { EnrollmentTag } from "@/components/EnrollmentTag"
import { formatDateTime } from "@/components/MessageThread"
import { NOTE_BODY_MAX, NOTE_CATEGORIES, NOTE_CATEGORY_HINTS, NOTE_CATEGORY_LABELS, type EventNote, type NoteCategory } from "@/lib/event-info"

type Edition = { id: number; held_on: string | null }
type Draft = { categories: NoteCategory[]; editionId: number | null; body: string }

const editionLabel = (heldOn: string | null) => heldOn ? `${heldOn.substring(0, 4)}年` : "開催日未定の回"

// 大会ごとのメモ（エントリー・参加賞・アクセスなど）。1つのメモに項目を複数付けられる。
// 新しい順に並べ、項目のボタンで絞り込む。書くのはメンバー全員、直す・消すのは書いた本人と管理人
export function EventNotes({ eventId, editions, notes, canWrite, onChanged }: {
    eventId: number
    editions: Edition[]
    notes: EventNote[]
    canWrite: boolean
    onChanged: () => void
}) {
    const [adding, setAdding] = useState(false)
    const [selected, setFilter] = useState<NoteCategory | null>(null)
    const sorted = [...notes].sort((a, b) => b.created_at.localeCompare(a.created_at))
    const used = NOTE_CATEGORIES.filter(c => notes.some(n => n.categories.includes(c)))
    // 選んでいた項目のメモがなくなったら（削除・編集で）すべてに戻す
    const filter = selected && used.includes(selected) ? selected : null
    const shown = filter ? sorted.filter(n => n.categories.includes(filter)) : sorted

    return (
        <div className="flex flex-col gap-2 text-sm">
            {notes.length === 0 && !adding && (
                <p className="text-gray-600">まだメモはありません。エントリーのしやすさ・参加賞・アクセス・宿・観光など、次に出る人の役に立つことを書いてください。</p>
            )}
            {used.length > 1 && (
                <div className="flex flex-wrap gap-1 text-xs">
                    {[null, ...used].map(c => (
                        <button
                            key={c ?? "all"}
                            onClick={() => setFilter(c)}
                            aria-pressed={filter === c}
                            className={`px-2 py-0.5 rounded border ${filter === c ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-gray-100"}`}
                        >
                            {c ? `${NOTE_CATEGORY_LABELS[c]}（${notes.filter(n => n.categories.includes(c)).length}）` : `すべて（${notes.length}）`}
                        </button>
                    ))}
                </div>
            )}
            {shown.map(n => <NoteItem key={n.id} note={n} editions={editions} onChanged={onChanged} />)}
            {canWrite && (adding ? (
                <NoteForm
                    editions={editions}
                    initial={{ categories: [], editionId: null, body: "" }}
                    submitLabel="メモを追加"
                    onCancel={() => setAdding(false)}
                    onSubmit={async d => {
                        const supabase = createClient()
                        const { data: { user } } = await supabase.auth.getUser()
                        if (!user) return "ログインしてください"
                        const { error } = await supabase.from("event_notes").insert({
                            event_id: eventId, edition_id: d.editionId, categories: d.categories, body: d.body, created_by: user.id,
                        })
                        if (error) return `保存に失敗しました: ${error.message}`
                        setAdding(false)
                        onChanged()
                        return null
                    }}
                />
            ) : (
                <button onClick={() => setAdding(true)} className="self-start px-3 py-1 border rounded bg-white hover:bg-gray-100 text-xs">メモを書く</button>
            ))}
        </div>
    )
}

function NoteItem({ note, editions, onChanged }: { note: EventNote; editions: Edition[]; onChanged: () => void }) {
    const [editing, setEditing] = useState(false)
    const [error, setError] = useState("")

    const handleDelete = async () => {
        if (!confirm("このメモを削除しますか？")) return
        const { error } = await createClient().from("event_notes").delete().eq("id", note.id)
        if (error) { setError(`削除に失敗しました: ${error.message}`); return }
        onChanged()
    }

    if (editing) {
        return (
            <NoteForm
                editions={editions}
                initial={{ categories: note.categories, editionId: note.edition_id, body: note.body }}
                submitLabel="保存"
                onCancel={() => setEditing(false)}
                onSubmit={async d => {
                    const { error } = await createClient().from("event_notes").update({
                        categories: d.categories, edition_id: d.editionId, body: d.body, updated_at: new Date().toISOString(),
                    }).eq("id", note.id)
                    if (error) return `保存に失敗しました: ${error.message}`
                    setEditing(false)
                    onChanged()
                    return null
                }}
            />
        )
    }
    return (
        <div className="bg-white border rounded p-2 flex flex-col gap-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs text-gray-600">
                {NOTE_CATEGORIES.filter(c => note.categories.includes(c)).map(c => (
                    <span key={c} className="px-1 rounded bg-blue-50 text-blue-800">{NOTE_CATEGORY_LABELS[c]}</span>
                ))}
                {note.edition_id != null && <span className="px-1 rounded bg-gray-100 text-gray-700">{editionLabel(note.edition_held_on)}の話</span>}
                <span className={note.author_gender === "female" ? "text-red-600" : ""}>
                    {note.author_name ?? "（退会したメンバー）"}<EnrollmentTag year={note.author_enrollment_year} />
                </span>
                <span>{formatDateTime(note.created_at)}{note.updated_at !== note.created_at && "（編集済み）"}</span>
                {note.can_edit && (
                    <>
                        <button onClick={() => setEditing(true)} className="text-blue-600 hover:underline">編集</button>
                        <button onClick={handleDelete} className="text-red-600 hover:underline">削除</button>
                    </>
                )}
            </div>
            <div><LinkifiedText text={note.body} /></div>
            {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
    )
}

function NoteForm({ editions, initial, submitLabel, onCancel, onSubmit }: {
    editions: Edition[]
    initial: Draft
    submitLabel: string
    onCancel: () => void
    // 失敗したらメッセージを返す
    onSubmit: (draft: Draft) => Promise<string | null>
}) {
    const [draft, setDraft] = useState(initial)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")
    const sortedEditions = [...editions].sort((a, b) => (b.held_on ?? "").localeCompare(a.held_on ?? ""))

    const toggle = (c: NoteCategory) => setDraft(d => ({
        ...d, categories: d.categories.includes(c) ? d.categories.filter(x => x !== c) : [...d.categories, c],
    }))

    const submit = async () => {
        if (draft.categories.length === 0) { setError("項目を1つ以上選んでください"); return }
        if (draft.body.trim() === "") { setError("本文を入力してください"); return }
        setBusy(true)
        setError("")
        const err = await onSubmit({ ...draft, body: draft.body.trim() })
        setBusy(false)
        if (err) setError(err)
    }

    const select = "border rounded px-1 py-0.5 bg-white"
    return (
        <div className="flex flex-col gap-2 border rounded p-2 bg-gray-50">
            <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <legend className="text-xs font-semibold mb-1">項目（いくつでも）</legend>
                {NOTE_CATEGORIES.map(c => (
                    <label key={c} className="flex items-center gap-1" title={NOTE_CATEGORY_HINTS[c] || undefined}>
                        <input type="checkbox" checked={draft.categories.includes(c)} onChange={() => toggle(c)} />
                        {NOTE_CATEGORY_LABELS[c]}
                        {NOTE_CATEGORY_HINTS[c] && <span className="text-xs text-gray-500">（{NOTE_CATEGORY_HINTS[c]}）</span>}
                    </label>
                ))}
            </fieldset>
            <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1">
                    いつの話か
                    <select
                        value={draft.editionId ?? ""}
                        onChange={e => setDraft({ ...draft, editionId: e.target.value === "" ? null : Number(e.target.value) })}
                        className={select}
                    >
                        <option value="">例年・全般</option>
                        {sortedEditions.map(ed => <option key={ed.id} value={ed.id}>{editionLabel(ed.held_on)}</option>)}
                    </select>
                </label>
            </div>
            <textarea
                value={draft.body}
                maxLength={NOTE_BODY_MAX}
                onChange={e => setDraft({ ...draft, body: e.target.value })}
                rows={4}
                placeholder="例: 東京から始発で日帰りできる。スタートは9時、駅から会場まで徒歩20分。前半に坂が多く後半は平坦。参加賞は T シャツと地元の特産品"
                className="w-full border rounded p-2 bg-white"
            />
            <div className="flex items-center gap-3">
                <button onClick={submit} disabled={busy} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-xs">
                    {busy ? "保存中..." : submitLabel}
                </button>
                <button onClick={onCancel} className="text-xs text-gray-600 hover:underline">やめる</button>
                <span className="text-xs text-gray-500 ml-auto">{draft.body.length} / {NOTE_BODY_MAX}</span>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
    )
}
