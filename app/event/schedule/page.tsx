import { Suspense } from "react"
import { ScheduleClient } from "@/components/ScheduleClient"

export default function EventSchedulePage() {
    return (
        // 絞り込み条件を URL から読むため（useSearchParams）
        <Suspense fallback={<p className="p-4 text-sm">読み込み中...</p>}>
            <ScheduleClient />
        </Suspense>
    )
}
