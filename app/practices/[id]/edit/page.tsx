import { notFound } from "next/navigation"
import { PracticeForm } from "@/components/PracticeForm"

export default async function EditPracticePage({ params }: { params: Promise<{ id: string }> }) {
    const id = Number((await params).id)
    if (!Number.isInteger(id)) notFound()
    return <PracticeForm practiceId={id} />
}
