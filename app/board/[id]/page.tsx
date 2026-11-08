import { notFound } from "next/navigation"
import { BoardThreadDetail } from "@/components/BoardThreadDetail"

export default async function BoardThreadPage({ params }: { params: Promise<{ id: string }> }) {
    const id = Number((await params).id)
    if (!Number.isInteger(id)) notFound()
    return <BoardThreadDetail id={id} />
}
