"use client"

import { useId, useMemo, useRef, useState } from "react"
import { EnrollmentTag } from "@/components/EnrollmentTag"
import { type SortableMember, compareMembers, matchesMember } from "@/lib/members"

export type ComboMember = SortableMember & {
    user_id: string
    // 選べない理由（登録済み・本人の設定など）。あれば一覧で薄く表示して選べない
    disabledReason?: string
    note?: string
}

// 名前・ふりがな・入学年度で絞り込んで1人選ぶ入力欄（一覧は入学年度の新しい順 → ふりがな順）。
// ↑↓ で移動、Enter で決定、Esc で閉じる
export function MemberCombobox({ members, value, onChange, placeholder = "名前・ふりがな・入学年度で検索", className }: {
    members: ComboMember[]
    value: string
    onChange: (userId: string) => void
    placeholder?: string
    className?: string
}) {
    const listId = useId()
    const [query, setQuery] = useState("")
    const [open, setOpen] = useState(false)
    const [active, setActive] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)
    const selected = members.find(m => m.user_id === value)

    const options = useMemo(
        () => members.filter(m => matchesMember(m, query)).sort(compareMembers).slice(0, 100),
        [members, query],
    )

    const choose = (m: ComboMember | undefined) => {
        if (!m || m.disabledReason) return
        onChange(m.user_id)
        setQuery("")
        setOpen(false)
    }

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive(i => Math.min(options.length - 1, i + 1)) }
        else if (e.key === "ArrowUp") { e.preventDefault(); setActive(i => Math.max(0, i - 1)) }
        else if (e.key === "Enter" && open) { e.preventDefault(); choose(options[active]) }
        else if (e.key === "Escape") setOpen(false)
    }

    return (
        <div className={`relative ${className ?? "w-56"}`}>
            {selected && !open ? (
                <button
                    type="button"
                    onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0) }}
                    className="w-full text-left border rounded px-1 py-0.5 bg-white truncate"
                >
                    {selected.name ?? "名前未設定"}<EnrollmentTag year={selected.enrollment_year} />
                    {selected.note && <span className="text-xs text-gray-500">{selected.note}</span>}
                    <span className="float-right text-gray-400" aria-hidden="true">▾</span>
                </button>
            ) : (
                <input
                    ref={inputRef}
                    value={query}
                    onChange={e => { setQuery(e.target.value); setOpen(true); setActive(0) }}
                    onFocus={() => setOpen(true)}
                    // 一覧のクリックが先に処理されるよう、閉じるのを少し遅らせる
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                    onKeyDown={onKeyDown}
                    placeholder={placeholder}
                    role="combobox"
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    className="w-full border rounded px-1 py-0.5 bg-white"
                />
            )}
            {open && (
                <ul id={listId} role="listbox" className="absolute z-30 mt-0.5 max-h-64 w-72 overflow-y-auto border rounded bg-white shadow-lg text-sm">
                    {value && (
                        <li>
                            <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onChange(""); setOpen(false) }} className="w-full text-left px-2 py-1 text-xs text-gray-600 hover:bg-gray-100">
                                選択を外す
                            </button>
                        </li>
                    )}
                    {options.length === 0 && <li className="px-2 py-1 text-gray-500">該当する人がいません</li>}
                    {options.map((m, i) => (
                        <li key={m.user_id} role="option" aria-selected={m.user_id === value} aria-disabled={!!m.disabledReason}>
                            <button
                                type="button"
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => choose(m)}
                                onMouseEnter={() => setActive(i)}
                                disabled={!!m.disabledReason}
                                className={`w-full text-left px-2 py-1 ${i === active ? "bg-blue-50" : ""} ${m.disabledReason ? "text-gray-400" : "hover:bg-blue-50"}`}
                            >
                                {m.name ?? "名前未設定"}<EnrollmentTag year={m.enrollment_year} />
                                {m.name_kana && <span className="ml-1 text-xs text-gray-500">{m.name_kana}</span>}
                                {m.note && <span className="ml-1 text-xs text-gray-500">{m.note}</span>}
                                {m.disabledReason && <span className="ml-1 text-xs">（{m.disabledReason}）</span>}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
