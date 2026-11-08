"use client"

import { useEffect, useState } from "react"
import { isNew } from "@/lib/seen"

// 「新着」の印。localStorage を読むため、画面に出てから判定する（サーバー側の描画とずれないように）
export function NewBadge({ kind, id, at }: { kind: string; id: number; at: string | null | undefined }) {
    const [show, setShow] = useState(false)
    useEffect(() => { setShow(isNew(kind, id, at)) }, [kind, id, at])
    if (!show) return null
    return <span className="text-xs font-normal px-1.5 py-0.5 rounded bg-red-500 text-white">新着</span>
}
