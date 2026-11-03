import { redirect } from "next/navigation"
import { EventAdminNav } from "@/components/EventAdminNav"
import { createClient } from "@/lib/supabase/server"
import { EditRacesClient } from "@/components/EditRacesClient"

export default async function EditRacesPage() {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getClaims()

    if (error || !data?.claims || data.claims.app_metadata?.role !== "admin") {
        redirect("/")
    }
    if (data.claims.aal !== "aal2") {
        redirect("/auth/mfa?next=/event/edit-races")
    }

    return (
        <div>
            <EventAdminNav current="/event/edit-races" />
            <h1 className="text-2xl font-bold mb-4 px-4 pt-2">種目編集</h1>
            <EditRacesClient />
        </div>
    )
}
