import { redirect } from "next/navigation"
import { EventAdminNav } from "@/components/EventAdminNav"
import { createClient } from "@/lib/supabase/server"
import { UnlinkedResultsClient } from "@/components/UnlinkedResultsClient"

export default async function UnlinkedResultsPage() {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getClaims()

    if (error || !data?.claims || data.claims.app_metadata?.role !== "admin") {
        redirect("/")
    }
    if (data.claims.aal !== "aal2") {
        redirect("/auth/mfa?next=/event/edit-unlinked")
    }

    return (
        <div>
            <EventAdminNav current="/event/edit-unlinked" />
            <h1 className="text-2xl font-bold mb-4 px-4 pt-2">紐付けのない記録</h1>
            <UnlinkedResultsClient />
        </div>
    )
}
