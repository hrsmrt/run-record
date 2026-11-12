import { Suspense } from "react"
import { EditionListClient } from "@/components/EditionListClient"

export default function EventEditionsPage() {
    return (
        // 絞り込み条件を URL から読むため（useSearchParams）
        <Suspense fallback={<p className="p-4 text-sm">読み込み中...</p>}>
            <EditionListClient />
        </Suspense>
    )
}
