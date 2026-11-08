import { redirect } from "next/navigation"
import { EventAdminNav } from "@/components/EventAdminNav"
import { createClient } from "@/lib/supabase/server"
import { MergeClient } from "@/components/MergeClient"

export default async function MergePage() {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getClaims()

    if (error || !data?.claims || data.claims.app_metadata?.role !== "admin") {
        redirect("/")
    }
    if (data.claims.aal !== "aal2") {
        redirect("/auth/mfa?next=/event/edit-merge")
    }

    return (
        <div>
            <EventAdminNav current="/event/edit-merge" />
            <h1 className="text-2xl font-bold mb-4 px-4 pt-2">重複をまとめる</h1>
            <MergeClient />
        </div>
    )
}
