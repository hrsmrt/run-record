import Link from "next/link"

// 管理画面を1つの大会に絞って開いたとき（大会詳細の管理者メニューから）の案内
export function AdminEventFilterNote({ eventId, eventName, basePath }: { eventId: number; eventName: string | undefined; basePath: string }) {
    return (
        <p className="mb-3 text-sm bg-amber-50 border border-amber-300 rounded px-2 py-1">
            「{eventName ?? `ID ${eventId}`}」（ID {eventId}）の分だけ表示しています。
            <Link href={basePath} className="ml-2 text-blue-600 hover:underline">すべて表示</Link>
            <Link href={`/event/${eventId}`} className="ml-2 text-blue-600 hover:underline">大会詳細へ</Link>
        </p>
    )
}
