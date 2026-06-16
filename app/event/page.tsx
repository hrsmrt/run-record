"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from 'react'
import { ExternalLink } from "lucide-react"
import Link from "next/link"

type Event = {
    id: number
    name: string
    url?: string
    prefecture?: string | null
}

const PREFECTURE_ORDER = [
    '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
    '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
    '新潟県','富山県','石川県','福井県','山梨県','長野県',
    '岐阜県','静岡県','愛知県','三重県',
    '滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県',
    '鳥取県','島根県','岡山県','広島県','山口県',
    '徳島県','香川県','愛媛県','高知県',
    '福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県',
]

const normalize = (p: string) => p.replace(/[都府県]$/, '')

const prefOrder = (p?: string | null) => {
    if (!p) return 999
    const norm = normalize(p)
    const i = PREFECTURE_ORDER.findIndex(pref => normalize(pref) === norm)
    return i === -1 ? 998 : i
}

export default function EventPage() {
    const [events, setEvents] = useState<Event[]>([])

    useEffect(() => {
        const fetchEvents = async () => {
            const supabase = createClient();
            const { data, error } = await supabase.from('events').select('*');
            if (error) {
                console.error('Error fetching events:', error);
            } else {
                const sorted = (data as Event[]).sort((a, b) => {
                    const pd = prefOrder(a.prefecture) - prefOrder(b.prefecture)
                    return pd !== 0 ? pd : a.name.localeCompare(b.name)
                })
                setEvents(sorted);
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
                                    <th className="px-1 md:px-3 py-0 text-left w-[20%]">県</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {events.map((event, index) => (
                                    <tr key={event.id}>
                                        <td className="px-1 md:px-3 py-0 text-right">{index + 1}.</td>
                                        <td className="px-1 md:px-3 py-0">{event.name}</td>
                                        <td className="px-1 md:px-3 py-0 whitespace-normal">
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
                                        <td className="px-1 md:px-3 py-0">{event.prefecture ?? ""}</td>
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
