"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from 'react'
import Link from "next/link"

type EventEdition = {
    id: number
    edition_number: number | null
    held_on: string | null
    events: {
        id: number
        name: string
        type: string
    }
}

export default function EventEditionsPage() {
    const [editions, setEditions] = useState<EventEdition[]>([])

    useEffect(() => {
        const fetchEditions = async () => {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('event_editions')
                .select('id, edition_number, held_on, events(id, name, type)')
                .order('held_on', { ascending: false })
            if (error) {
                console.error('Error fetching event editions:', error)
            } else {
                setEditions(data as unknown as EventEdition[])
            }
        }
        fetchEditions()
    }, [])

    return (
        <main className="min-h-screen flex flex-col items-center p-4">
            <div className="w-full max-w-3xl">
                <nav className="flex gap-4 mb-3 text-sm">
                    <Link href="/event" className="text-blue-600 hover:underline">大会一覧</Link>
                    <span className="font-bold">開催一覧</span>
                    <Link href="/event/schedule" className="text-blue-600 hover:underline">カレンダー</Link>
                </nav>
                <h1 className="text-lg font-bold mb-2">大会開催一覧</h1>
                <div className="bg-white text-black p-2 text-[8px] md:text-base">
                    <div className="overflow-x-auto">
                        <table className="table-fixed border-collapse w-full text-black bg-white font-mono">
                            <thead>
                                <tr className="bg-white">
                                    <th className="px-1 md:px-3 py-0 w-[8%]"></th>
                                    <th className="px-1 md:px-3 py-0 text-left w-[18%]">開催日</th>
                                    <th className="px-1 md:px-3 py-0 text-left">大会名</th>
                                    <th className="px-1 md:px-3 py-0 text-right w-[14%]">回数</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {editions.map((ed, index) => (
                                    <tr key={ed.id}>
                                        <td className="px-1 md:px-3 py-0 text-right">{index + 1}.</td>
                                        <td className="px-1 md:px-3 py-0">
                                            {ed.held_on
                                                ? `${ed.held_on.substring(0, 4)}/${ed.held_on.substring(5, 7)}/${ed.held_on.substring(8, 10)}`
                                                : ""}
                                        </td>
                                        <td className="px-1 md:px-3 py-0">
                                            <span className="inline-flex items-center gap-2">
                                                {ed.events.name}
                                                <Link href={`/event/${ed.events.id}`} className="text-xs text-blue-600 hover:underline shrink-0">詳細</Link>
                                            </span>
                                        </td>
                                        <td className="px-1 md:px-3 py-0 text-right">
                                            {ed.edition_number != null ? `第${ed.edition_number}回` : ""}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </main>
    )
}
