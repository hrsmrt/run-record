"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useUnsavedWarning } from "@/lib/use-unsaved-warning"
import { DateOptionsEditor, type DateOptionDraft } from "@/components/DateOptionsEditor"
import { BOARD_TEXT_MAX, BOARD_THREAD_TITLE_MAX } from "@/lib/board"
import { formatDate } from "@/components/RaceGroups"

type Edition = { id: number; held_on: string | null; event_id: number; event_name: string }

// 掲示板に話題を立てる。候補日を入れると日程調整（○△×）ができる。
// 大会の予定から来たとき（?edition=開催回ID）は、その大会に結び付けて立てる
export function BoardThreadForm() {
    const router = useRouter()
    const [title, setTitle] = useState("")
    const [body, setBody] = useState("")
    const [options, setOptions] = useState<DateOptionDraft[]>([])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const [edition, setEdition] = useState<Edition | null>(null)

    useEffect(() => {
        const id = Number(new URLSearchParams(window.location.search).get("edition"))
        if (!Number.isInteger(id) || id <= 0) return
        createClient().from("event_editions").select("id, held_on, event_id, events(name)").eq("id", id).maybeSingle()
            .then(({ data }) => {
                if (!data) return
                const ev = data.events as unknown as { name: string } | null
                const ed = { id: data.id, held_on: data.held_on, event_id: data.event_id, event_name: ev?.name ?? "" }
                setEdition(ed)
                setTitle(prev => prev === "" ? `${ed.event_name}${ed.held_on ? `（${formatDate(ed.held_on)}）` : ""}`.slice(0, BOARD_THREAD_TITLE_MAX) : prev)
            })
    }, [])

    useUnsavedWarning(!saving && (title !== "" || body !== "" || options.length > 0))

    const handleSave = async () => {
        if (title.trim() === "") { setError("タイトルを入力してください"); return }
        const filled = options.filter(o => o.date !== "")
        const keys = filled.map(o => `${o.date}|${o.label.trim()}`)
        if (new Set(keys).size !== keys.length) { setError("同じ候補日（補足も同じ）が重なっています"); return }
        setSaving(true)
        setError("")
        const supabase = createClient()
        const { data, error } = await supabase.from("board_threads")
            .insert({ title: title.trim(), body: body.trim() || null, edition_id: edition?.id ?? null })
            .select("id")
            .single()
        if (error) { setSaving(false); setError(`保存に失敗しました: ${error.message}`); return }
        if (filled.length > 0) {
            const { error: optError } = await supabase.from("thread_date_options")
                .insert(filled.map(o => ({ thread_id: data.id, option_date: o.date, label: o.label.trim() })))
            // 話題はできているので、候補日だけ失敗したときも話題のページへ進む（そこで追加し直せる）
            if (optError) alert(`話題は作成しましたが、候補日の保存に失敗しました（${optError.message}）。話題のページから追加し直してください。`)
        }
        router.push(`/board/${data.id}`)
    }

    return (
        <div className="max-w-3xl mx-auto p-4 text-black flex flex-col gap-4">
            <Link href="/board" className="text-sm text-blue-600 hover:underline">← 掲示板</Link>
            <h1 className="text-2xl font-bold">話題を立てる</h1>
            {edition && (
                <p className="text-sm bg-white border rounded px-2 py-1">
                    大会:{" "}
                    <Link href={`/event/${edition.event_id}#edition-${edition.id}`} className="text-blue-600 hover:underline">
                        {edition.event_name}{edition.held_on && `（${formatDate(edition.held_on)}）`}
                    </Link>
                    <span className="text-xs text-gray-500 ml-2">この話題は大会のページとホームの募集からもリンクされます</span>
                    <button onClick={() => setEdition(null)} className="ml-2 text-xs text-gray-600 hover:underline">結び付けない</button>
                </p>
            )}
            <label className="flex flex-col gap-1">
                <span className="font-semibold">タイトル</span>
                <input value={title} maxLength={BOARD_THREAD_TITLE_MAX} onChange={e => setTitle(e.target.value)} placeholder="例: 12月の30km走の日程" className="border rounded px-2 py-1 bg-white" />
            </label>
            <label className="flex flex-col gap-1">
                <span className="font-semibold">本文 <span className="text-xs font-normal text-gray-500">（任意）</span></span>
                <textarea value={body} maxLength={BOARD_TEXT_MAX} onChange={e => setBody(e.target.value)} rows={6} className="w-full border rounded p-2 bg-white" />
            </label>
            <div className="flex flex-col gap-1">
                <span className="font-semibold">日程調整の候補日 <span className="text-xs font-normal text-gray-500">（任意。入れるとメンバーが ○△× を付けられます）</span></span>
                <DateOptionsEditor options={options} onChange={setOptions} />
            </div>
            <div className="flex items-center gap-3">
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                    {saving ? "保存中..." : "話題を立てる"}
                </button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <p className="text-xs text-gray-500">※ 掲示板はログインしたメンバー全員が読めます。改行はそのまま表示され、URL はリンクになります。</p>
        </div>
    )
}
