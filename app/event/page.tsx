import { Suspense } from "react"
import { EventListClient } from "@/components/EventListClient"

export default function EventPage() {
    return (
        // 絞り込み条件を URL から読むため（useSearchParams）
        <Suspense fallback={<p className="p-4 text-sm">読み込み中...</p>}>
            <EventListClient />
        </Suspense>
    )
}
