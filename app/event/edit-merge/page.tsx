import { redirect } from "next/navigation"
import { EventAdminNav } from "@/components/EventAdminNav"
import { createClient } from "@/lib/supabase/server"
import { MergeClient, type MergeInitial } from "@/components/MergeClient"

type Params = { kind?: string; event?: string; edition?: string; from?: string; into?: string }

const idOf = (v: string | undefined) => {
    const n = Number(v)
    return Number.isInteger(n) && n > 0 ? n : undefined
}

// ?kind=event|edition|race&event=&edition=&from=&into= で、選んだ状態から始める（大会詳細の管理者メニューから）
export default async function MergePage({ searchParams }: { searchParams: Promise<Params> }) {
    const params = await searchParams
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getClaims()

    if (error || !data?.claims || data.claims.app_metadata?.role !== "admin") {
        redirect("/")
    }
    if (data.claims.aal !== "aal2") {
        redirect("/auth/mfa?next=/event/edit-merge")
    }

    const kind = params.kind === "event" || params.kind === "edition" || params.kind === "race" ? params.kind : undefined
    const initial: MergeInitial = kind ? {
        kind,
        eventId: idOf(params.event),
        editionId: idOf(params.edition),
        fromId: idOf(params.from),
        intoId: idOf(params.into),
    } : {}

    return (
        <div>
            <EventAdminNav current="/event/edit-merge" />
            <h1 className="text-2xl font-bold mb-4 px-4 pt-2">重複をまとめる</h1>
            <MergeClient initial={initial} />
        </div>
    )
}
