import { redirect } from "next/navigation"
import { EventAdminNav } from "@/components/EventAdminNav"
import { createClient } from "@/lib/supabase/server"
import { ResultsHistoryClient } from "@/components/ResultsHistoryClient"

export default async function EditHistoryPage() {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getClaims()

    if (error || !data?.claims || data.claims.app_metadata?.role !== "admin") {
        redirect("/")
    }
    if (data.claims.aal !== "aal2") {
        redirect("/auth/mfa?next=/event/edit-history")
    }

    return (
        <div>
            <EventAdminNav current="/event/edit-history" />
            <h1 className="text-2xl font-bold mb-4 px-4 pt-2">記録の変更履歴</h1>
            <ResultsHistoryClient />
        </div>
    )
}
