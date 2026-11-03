import { redirect } from "next/navigation"
import { EventAdminNav } from "@/components/EventAdminNav"
import { createClient } from "@/lib/supabase/server"
import { EditEventEditionsClient } from "@/components/EditEventEditionsClient"

export default async function EditEventEditionsPage() {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getClaims()

    if (error || !data?.claims || data.claims.app_metadata?.role !== "admin") {
        redirect("/")
    }
    if (data.claims.aal !== "aal2") {
        redirect("/auth/mfa?next=/event/edit-editions")
    }

    return (
        <div>
            <EventAdminNav current="/event/edit-editions" />
            <h1 className="text-2xl font-bold mb-4 px-4 pt-2">大会開催日編集</h1>
            <EditEventEditionsClient />
        </div>
    )
}
