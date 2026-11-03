import { redirect } from "next/navigation"
import { EventAdminNav } from "@/components/EventAdminNav"
import { createClient } from "@/lib/supabase/server"
import { BulkResultsClient } from "@/components/BulkResultsClient"

export default async function EditResultsPage() {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getClaims()

    if (error || !data?.claims || data.claims.app_metadata?.role !== "admin") {
        redirect("/")
    }
    if (data.claims.aal !== "aal2") {
        redirect("/auth/mfa?next=/event/edit-results")
    }

    return (
        <div>
            <EventAdminNav current="/event/edit-results" />
            <h1 className="text-2xl font-bold mb-4 px-4 pt-2">記録一括登録</h1>
            <BulkResultsClient />
        </div>
    )
}
