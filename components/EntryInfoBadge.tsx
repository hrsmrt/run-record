import { ENTRY_DIFFICULTY_STYLES, type EventEntryInfo, entryInfoLabel } from "@/lib/event-info"

// 一覧に出す「例年 抽選・激戦」の印（未設定なら何も出さない）
export function EntryInfoBadge({ info }: { info: EventEntryInfo | undefined }) {
    const label = entryInfoLabel(info)
    if (!label) return null
    const style = info?.entry_difficulty ? ENTRY_DIFFICULTY_STYLES[info.entry_difficulty] : "bg-gray-100 text-gray-700"
    return <span className={`text-xs font-normal px-1 rounded ${style}`}>{label}</span>
}
