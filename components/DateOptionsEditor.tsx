"use client"

// 日程調整の候補日の入力欄（日付と「朝」「19時〜」などの補足）
export type DateOptionDraft = { key: number; date: string; label: string }

export function DateOptionsEditor({ options, onChange }: { options: DateOptionDraft[]; onChange: (next: DateOptionDraft[]) => void }) {
    const nextKey = () => Math.max(0, ...options.map(o => o.key)) + 1
    const update = (key: number, patch: Partial<DateOptionDraft>) => onChange(options.map(o => o.key === key ? { ...o, ...patch } : o))
    return (
        <div className="flex flex-col gap-1 text-sm">
            {options.map(o => (
                <div key={o.key} className="flex flex-wrap items-center gap-2">
                    <input type="date" value={o.date} onChange={e => update(o.key, { date: e.target.value })} className="border rounded px-2 py-1 bg-white" aria-label="候補日" />
                    <input value={o.label} maxLength={30} onChange={e => update(o.key, { label: e.target.value })} placeholder="補足（例: 朝、19時〜）" className="border rounded px-2 py-1 bg-white w-40" />
                    <button type="button" onClick={() => onChange(options.filter(x => x.key !== o.key))} className="text-xs text-red-600 hover:underline">削除</button>
                </div>
            ))}
            <button type="button" onClick={() => onChange([...options, { key: nextKey(), date: "", label: "" }])} className="self-start text-xs text-blue-600 hover:underline">
                ＋ 候補日を追加
            </button>
        </div>
    )
}
