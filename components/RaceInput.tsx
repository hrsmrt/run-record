"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

export type RaceOption = {
    id: number
    label: string
    eventName: string
    heldOn: string | null
    distanceKm: number
}

type RaceRow = {
    id: number
    name: string
    distance_km: number
    event_editions: { held_on: string | null; events: { name: string } }
}

const formatDate = (d: string) => `${d.substring(0, 4)}/${d.substring(5, 7)}/${d.substring(8, 10)}`

// 「大会名 YYYY/MM/DD 種目名」の選択肢を新しい開催日順で取得する
export function useRaceOptions() {
    const [options, setOptions] = useState<RaceOption[] | null>(null)
    const [error, setError] = useState("")

    useEffect(() => {
        const fetch = async () => {
            const supabase = createClient()
            const { data, error } = await supabase
                .from("races")
                .select("id, name, distance_km, event_editions(held_on, events(name))")
            if (error) { setError(error.message); setOptions([]); return }
            const rows = data as unknown as RaceRow[]
            setOptions(rows
                .map(r => {
                    const heldOn = r.event_editions.held_on
                    const eventName = r.event_editions.events.name
                    return {
                        id: r.id,
                        label: `${eventName} ${heldOn ? formatDate(heldOn) : "開催日未定"} ${r.name}`,
                        eventName,
                        heldOn,
                        distanceKm: Number(r.distance_km),
                    }
                })
                .sort((a, b) => (b.heldOn ?? "").localeCompare(a.heldOn ?? "") || a.label.localeCompare(b.label)))
        }
        fetch()
    }, [])

    return { options, error }
}

// 候補リスト本体。ページ内に1つ置き、各入力欄から listId で参照する
export function RaceDatalist({ id, options }: { id: string; options: RaceOption[] }) {
    return (
        <datalist id={id}>
            {options.map(o => <option key={o.id} value={o.label} />)}
        </datalist>
    )
}

// 候補と完全一致したら選択、空欄なら紐付けなし。一致しない入力中は赤枠で示す
export function RaceInput({ listId, options, value, onChange, className }: {
    listId: string
    options: RaceOption[]
    value: number | null
    onChange: (option: RaceOption | null) => void
    className?: string
}) {
    const [text, setText] = useState(() => options.find(o => o.id === value)?.label ?? "")
    const unmatched = text !== "" && !options.some(o => o.label === text)

    return (
        <input
            type="text"
            list={listId}
            value={text}
            placeholder="大会名で検索（空欄なら紐付けなし）"
            onChange={e => {
                setText(e.target.value)
                onChange(options.find(o => o.label === e.target.value) ?? null)
            }}
            className={`${className ?? ""} ${unmatched ? "border-red-500" : ""}`}
        />
    )
}
