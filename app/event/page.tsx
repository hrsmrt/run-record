"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from 'react'
import { ExternalLink } from "lucide-react"
import Link from "next/link"

type Event = {
    id: number
    name: string
    url?: string
}

export default function EventPage() {
    const [events, setEvents] = useState<Event[]>([])

    useEffect(() => {
        const fetchEvents = async () => {
            const supabase = createClient();
            const { data, error } = await supabase.from('events').select('*').order('name', { ascending: true });
            if (error) {
                console.error('Error fetching events:', error);
            } else {
                setEvents(data as Event[]);
            }
        };
        fetchEvents();
    }, []);

    return (
        <main className="min-h-screen flex flex-col items-center p-4">
            <div className="w-full max-w-2xl">
                <nav className="flex gap-4 mb-3 text-sm">
                    <span className="font-bold">大会一覧</span>
                    <Link href="/event/editions" className="text-blue-600 hover:underline">開催一覧</Link>
                    <Link href="/event/schedule" className="text-blue-600 hover:underline">カレンダー</Link>
                </nav>
                <h1 className="text-lg font-bold mb-2">大会一覧</h1>
                <div className="bg-white text-black p-2 text-[8px] md:text-base">
                    <div className="overflow-x-auto">
                        <table className="table-fixed border-collapse w-full text-black bg-white font-mono">
                            <thead>
                                <tr className="bg-white">
                                    <th className="px-1 md:px-3 py-0 w-[8%]"></th>
                                    <th className="px-1 md:px-3 py-0 text-left">大会名</th>
                                    <th className="px-1 md:px-3 py-0 text-left">URL</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {events.map((event, index) => (
                                    <tr key={event.id}>
                                        <td className="px-1 md:px-3 py-0 text-right">{index + 1}.</td>
                                        <td className="px-1 md:px-3 py-0">{event.name}</td>
                                        <td className="px-1 md:px-3 py-0">
                                            {event.url && (
                                                <a
                                                    href={event.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 hover:underline inline-flex items-center gap-1"
                                                >
                                                    {event.url}
                                                    <ExternalLink size={12} className="inline shrink-0" />
                                                </a>
                                            )}
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
