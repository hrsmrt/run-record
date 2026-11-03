import { redirect } from "next/navigation"
import { EventAdminNav } from "@/components/EventAdminNav"
import { createClient } from "@/lib/supabase/server"
import { EditEventsClient } from "@/components/EditEventsClient"

export default async function EditEventsPage() {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getClaims()

    if (error || !data?.claims || data.claims.app_metadata?.role !== "admin") {
        redirect("/")
    }
    if (data.claims.aal !== "aal2") {
        redirect("/auth/mfa?next=/event/edit-events")
    }

    return (
        <div>
            <EventAdminNav current="/event/edit-events" />
            <h1 className="text-2xl font-bold mb-4 px-4 pt-2">大会編集</h1>
            <EditEventsClient />
        </div>
    )
}
