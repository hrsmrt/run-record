import { notFound } from "next/navigation"
import { PracticeDetail } from "@/components/PracticeDetail"

export default async function PracticePage({ params }: { params: Promise<{ id: string }> }) {
    const id = Number((await params).id)
    if (!Number.isInteger(id)) notFound()
    return <PracticeDetail id={id} />
}
