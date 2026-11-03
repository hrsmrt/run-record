import Link from "next/link"
import { LinkifiedText } from "@/components/CommentText"

export type RaceReport = {
    id: number
    event_edition_id: number
    event_id: number
    held_on: string | null
    author_name: string | null
    author_gender: string | null
    race_body: string | null
    travel_body: string | null
    updated_at: string
    is_runner: boolean
    is_mine: boolean
}

const formatDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
}

// 開催回ごとの大会レポート一覧。canWrite のときは自分のレポートを書く・編集するリンクを出す
export function EditionReports({ editionId, reports, canWrite }: {
    editionId: number
    reports: RaceReport[]
    canWrite: boolean
}) {
    const hasMine = reports.some(r => r.is_mine)
    if (reports.length === 0 && !canWrite) return null

    return (
        <div className="mt-2">
            <div className="flex items-center gap-3 mb-1">
                <h4 className="text-xs font-bold text-gray-600">大会レポート{reports.length > 0 && `（${reports.length}件）`}</h4>
                {canWrite && (
                    <Link href={`/reports/edit/${editionId}`} className="text-xs text-blue-600 hover:underline">
                        {hasMine ? "自分のレポートを編集" : "レポートを書く"}
                    </Link>
                )}
            </div>
            <div className="flex flex-col gap-3">
                {reports.map(r => (
                    <article key={r.id} className="bg-white text-black p-3 border rounded text-sm">
                        <header className="flex flex-wrap items-center gap-2 mb-2">
                            <span className={`font-bold ${r.author_gender === "female" ? "text-red-600" : ""}`}>
                                {r.author_name ?? "名前未設定"}
                            </span>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                {r.is_runner ? "出走" : "応援"}
                            </span>
                            <span className="text-xs text-gray-500">更新 {formatDate(r.updated_at)}</span>
                        </header>
                        {r.race_body && (
                            <section className="mb-2">
                                <h5 className="text-xs font-bold text-gray-600 mb-0.5">レースの感想</h5>
                                <LinkifiedText text={r.race_body} />
                            </section>
                        )}
                        {r.travel_body && (
                            <section>
                                <h5 className="text-xs font-bold text-gray-600 mb-0.5">観光・グルメ・宿・アクセス</h5>
                                <LinkifiedText text={r.travel_body} />
                            </section>
                        )}
                    </article>
                ))}
            </div>
        </div>
    )
}
