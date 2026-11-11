import Link from "next/link"

const PAGES = [
    { href: "/event/edit-events", label: "大会編集" },
    { href: "/event/edit-editions", label: "開催日編集" },
    { href: "/event/edit-races", label: "種目編集" },
    { href: "/event/edit-results", label: "記録一括登録" },
    { href: "/event/edit-members", label: "メンバー編集" },
    { href: "/event/edit-history", label: "記録の変更履歴" },
    { href: "/event/edit-merge", label: "重複をまとめる" },
    { href: "/event/edit-unlinked", label: "紐付けのない記録" },
]

export function EventAdminNav({ current }: { current: string }) {
    return (
        <nav className="flex gap-4 px-4 pt-4 text-sm">
            {PAGES.map(p => p.href === current
                ? <span key={p.href} className="font-bold">{p.label}</span>
                : <Link key={p.href} href={p.href} className="text-blue-600 hover:underline">{p.label}</Link>
            )}
        </nav>
    )
}
