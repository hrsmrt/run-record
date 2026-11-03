"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useUnsavedWarning } from "@/lib/use-unsaved-warning"

type Edition = {
    id: number
    held_on: string | null
    edition_number: number | null
    events: { id: number; name: string }
}

const MAX_LENGTH = 10000

const formatDate = (d: string) => `${d.substring(0, 4)}/${d.substring(5, 7)}/${d.substring(8, 10)}`

export default function EditReportPage() {
    const { editionId } = useParams<{ editionId: string }>()
    const router = useRouter()
    const [edition, setEdition] = useState<Edition | null>(null)
    const [reportId, setReportId] = useState<number | null>(null)
    const [raceBody, setRaceBody] = useState("")
    const [travelBody, setTravelBody] = useState("")
    const [status, setStatus] = useState<"loading" | "notFound" | "ok">("loading")
    const [dirty, setDirty] = useState(false)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

    useUnsavedWarning(dirty)

    useEffect(() => {
        const fetch = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            const id = Number(editionId)
            if (!user || !Number.isInteger(id)) { setStatus("notFound"); return }

            const { data: ed } = await supabase
                .from("event_editions")
                .select("id, held_on, edition_number, events(id, name)")
                .eq("id", id)
                .maybeSingle()
            if (!ed) { setStatus("notFound"); return }
            setEdition(ed as unknown as Edition)

            const { data: report } = await supabase
                .from("race_reports")
                .select("id, race_body, travel_body")
                .eq("event_edition_id", id)
                .eq("user_id", user.id)
                .maybeSingle()
            if (report) {
                setReportId(report.id)
                setRaceBody(report.race_body ?? "")
                setTravelBody(report.travel_body ?? "")
            }
            setStatus("ok")
        }
        fetch()
    }, [editionId])

    const backHref = edition ? `/event/${edition.events.id}#edition-${edition.id}` : "/event"

    const handleSave = async () => {
        if (!edition) return
        if (raceBody.trim() === "" && travelBody.trim() === "") {
            setMessage({ text: "レースの感想か観光などのどちらかを入力してください", isError: true })
            return
        }
        setSaving(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setSaving(false); setMessage({ text: "ログインしてください", isError: true }); return }
        const { data, error } = await supabase
            .from("race_reports")
            .upsert({
                event_edition_id: edition.id,
                user_id: user.id,
                race_body: raceBody.trim() === "" ? null : raceBody,
                travel_body: travelBody.trim() === "" ? null : travelBody,
                updated_at: new Date().toISOString(),
            }, { onConflict: "event_edition_id,user_id" })
            .select("id")
            .single()
        setSaving(false)
        if (error) { setMessage({ text: `保存に失敗しました: ${error.message}`, isError: true }); return }
        setReportId(data.id)
        setDirty(false)
        setMessage({ text: "保存しました", isError: false })
    }

    const handleDelete = async () => {
        if (!reportId || !confirm("このレポートを削除しますか？")) return
        const supabase = createClient()
        const { error } = await supabase.from("race_reports").delete().eq("id", reportId)
        if (error) { setMessage({ text: `削除に失敗しました: ${error.message}`, isError: true }); return }
        setDirty(false)
        router.push(backHref)
    }

    if (status === "loading") return <p className="p-4">読み込み中...</p>
    if (status === "notFound" || !edition) return <p className="p-4">開催回が見つかりませんでした。</p>

    return (
        <div className="max-w-3xl mx-auto p-4 text-black">
            <Link href={backHref} className="text-sm text-blue-600 hover:underline">← 大会詳細に戻る</Link>
            <h1 className="text-2xl font-bold mt-2 mb-1">大会レポート</h1>
            <p className="mb-4 text-sm">
                {edition.events.name}
                {edition.held_on && `（${formatDate(edition.held_on)}）`}
                {edition.edition_number != null && ` 第${edition.edition_number}回`}
            </p>

            <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-1">
                    <span className="font-semibold">レースの感想</span>
                    <span className="text-xs text-gray-500">コース・給水・応援・ペース配分など（応援で参加した場合は応援の様子など）</span>
                    <textarea
                        value={raceBody}
                        maxLength={MAX_LENGTH}
                        onChange={e => { setRaceBody(e.target.value); setDirty(true) }}
                        rows={10}
                        className="w-full border rounded p-2 bg-white"
                    />
                    <span className="text-xs text-gray-500 text-right">{raceBody.length} / {MAX_LENGTH}</span>
                </label>
                <label className="flex flex-col gap-1">
                    <span className="font-semibold">観光・グルメ・宿・アクセス</span>
                    <span className="text-xs text-gray-500">前後に立ち寄った場所、食事、宿、移動手段など</span>
                    <textarea
                        value={travelBody}
                        maxLength={MAX_LENGTH}
                        onChange={e => { setTravelBody(e.target.value); setDirty(true) }}
                        rows={10}
                        className="w-full border rounded p-2 bg-white"
                    />
                    <span className="text-xs text-gray-500 text-right">{travelBody.length} / {MAX_LENGTH}</span>
                </label>
            </div>

            <div className="mt-4 flex items-center gap-3">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                    {saving ? "保存中..." : "保存"}
                </button>
                {reportId && (
                    <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                        削除
                    </button>
                )}
                {dirty && <span className="text-sm text-gray-500">未保存の変更があります</span>}
            </div>
            {message && (
                <p className={`mt-2 text-sm ${message.isError ? "text-red-600" : "text-green-700"}`}>{message.text}</p>
            )}
            <p className="mt-4 text-xs text-gray-500">
                ※ 改行はそのまま表示されます。URL を書くとリンクになります（[表示する文字](URL) の形でも書けます）。
                <br />
                ※ レポートはログインしたメンバー全員が読めます。
            </p>
        </div>
    )
}
