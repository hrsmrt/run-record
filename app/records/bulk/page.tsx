import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { BulkResultsClient } from "@/components/BulkResultsClient"
import { OrganizerStart } from "@/components/OrganizerStart"

const formatDate = (d: string) => `${d.substring(0, 4)}/${d.substring(5, 7)}/${d.substring(8, 10)}`

// 記録係が、記録係をしている開催回の種目に記録をまとめて登録する（?edition=開催回ID）。
// 開催回の指定がなければ、大会 → 開催日 → 種目を選んで記録係になる入口を出す。
// 実際に書き込めるかは DB（記録係のポリシー）で判定する。ここでは記録係でなければ案内を出す
export default async function OrganizerBulkPage({ searchParams }: { searchParams: Promise<{ edition?: string }> }) {
    const editionParam = (await searchParams).edition
    if (!editionParam) return <OrganizerStart />
    const editionId = Number(editionParam)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !Number.isInteger(editionId) || editionId <= 0) return <p className="p-4">開催回の指定が正しくありません。</p>

    const [{ data: edition }, { data: organizer }] = await Promise.all([
        supabase.from("event_editions").select("id, held_on, edition_number, events(id, name)").eq("id", editionId).maybeSingle(),
        supabase.from("edition_organizers").select("user_id").eq("event_edition_id", editionId).eq("user_id", user.id).maybeSingle(),
    ])
    if (!edition) return <p className="p-4">開催回が見つかりませんでした。</p>
    const event = edition.events as unknown as { id: number; name: string }
    const back = `/event/${event.id}#edition-${edition.id}`
    if (!organizer) {
        return (
            <div className="p-4 text-sm">
                <p>この開催回の記録係ではありません。大会詳細の開催回の「記録係になる」から記録係になると、記録をまとめて登録できます。</p>
                <Link href={back} className="text-blue-600 hover:underline">大会詳細へ</Link>
            </div>
        )
    }

    return (
        <div>
            <div className="px-4 pt-4">
                <Link href={back} className="text-sm text-blue-600 hover:underline">← 大会詳細に戻る</Link>
                <h1 className="text-2xl font-bold mt-2">記録をまとめて登録（記録係）</h1>
                <p className="text-sm">
                    {event.name} {edition.held_on ? formatDate(edition.held_on) : "開催日未定"}
                    {edition.edition_number != null && ` 第${edition.edition_number}回`}
                </p>
            </div>
            <BulkResultsClient editionId={editionId} />
        </div>
    )
}
