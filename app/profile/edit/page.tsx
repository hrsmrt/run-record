"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { enrollmentToStr, parseEnrollmentYear } from "@/lib/enrollment"

type Profile = {
    name: string
    display_name: string
    gender: string
    birth_year: number | null
}

export default function ProfileEditPage() {
    const router = useRouter()
    const [profile, setProfile] = useState<Profile>({ name: "", display_name: "", gender: "", birth_year: 2000 })
    const [enrollmentStr, setEnrollmentStr] = useState("")
    // 「他の人（幹事）に自分の記録を登録させない」
    const [blockOthersEntry, setBlockOthersEntry] = useState(false)
    const [nameKana, setNameKana] = useState("")
    const [loading, setLoading] = useState(true)
    // ログイン後にプロフィールがなくて案内されてきたとき（?welcome=1）
    const [welcome, setWelcome] = useState(false)

    useEffect(() => {
        setWelcome(new URLSearchParams(window.location.search).get("welcome") === "1")
        const fetchProfile = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data, error } = await supabase
                .from("profiles")
                .select("name, display_name, gender, birth_year, enrollment_year, block_others_entry, name_kana")
                .eq("user_id", user.id)
                .maybeSingle()

            if (error) {
                console.error(error)
            } else if (data) {
                const { enrollment_year, block_others_entry, name_kana, ...rest } = data
                setBlockOthersEntry(block_others_entry)
                setNameKana(name_kana ?? "")
                setProfile(rest) // ←ここでフォームの初期値として設定
                setEnrollmentStr(enrollmentToStr(enrollment_year))
            }

            setLoading(false)
        }
        fetchProfile()
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const enrollmentYear = parseEnrollmentYear(enrollmentStr)
        if (enrollmentYear === undefined) {
            alert("入学年度は西暦4桁（例: 2017）で入力してください")
            return
        }
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
            .from("profiles")
            .upsert({
                user_id: user.id,
                name: profile.name ?? "",
                display_name: profile.display_name ?? "",
                gender: profile.gender ?? "",
                birth_year: profile.birth_year ?? null,
                enrollment_year: enrollmentYear,
                block_others_entry: blockOthersEntry,
                name_kana: nameKana.trim() || null,
            },
                { onConflict: "user_id" }  // user_id が被ったら update
            )

        if (error) {
            console.error(error)
            alert("保存に失敗しました")
            return
        }

        console.log("Saved profile:", data)
        router.push("/profile")
    }

    if (loading) return <div>読み込み中...</div>

    return (
        <div className="max-w-xl mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">プロフィール編集</h1>
            {welcome && (
                <p className="mb-4 p-2 text-sm bg-blue-50 border border-blue-200 rounded">
                    プロフィールがまだ登録されていません。表示名・性別・入学年度を入力してください。表示名は記録の一覧に表示されます（生年は公開されません）。
                </p>
            )}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <label>
                    名前:
                    <input
                        type="text"
                        value={profile.name ?? ""}
                        onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                        className="border p-2 w-full"
                    />
                    ふりがな:
                    <input
                        type="text"
                        value={nameKana}
                        onChange={(e) => setNameKana(e.target.value)}
                        placeholder="例: むらた ひろし（一覧の並び順・検索に使います）"
                        className="border p-2 w-full"
                    />
                    表示名:
                    <input
                        type="text"
                        value={profile.display_name ?? ""}
                        onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                        className="border p-2 w-full"
                    />
                    性別:
                    <select
                        value={profile.gender ?? ""}
                        onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                        className="border p-2 w-full"
                    >
                        <option value="">性別</option>
                        <option value="male">男性</option>
                        <option value="female">女性</option>
                    </select>
                    生年:
                    <input
                        type="number"
                        value={profile.birth_year ?? ""}
                        onChange={(e) => setProfile({ ...profile, birth_year: e.target.value === "" ? null : Number(e.target.value) })}
                        className="border p-2 w-full"
                    />
                    入学年度:
                    <input
                        type="text"
                        inputMode="numeric"
                        value={enrollmentStr}
                        onChange={(e) => setEnrollmentStr(e.target.value)}
                        placeholder="例: 2017"
                        className="border p-2 w-full"
                    />
                </label>
                <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={blockOthersEntry} onChange={e => setBlockOthersEntry(e.target.checked)} className="mt-1" />
                    <span>
                        他の人（大会の幹事）に自分の記録を登録させない
                        <span className="block text-xs text-gray-500">オンにすると、幹事の一括登録で自分を選べなくなります。自分で登録した記録・管理者による登録には影響しません。</span>
                    </span>
                </label>
                <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    保存
                </button>
            </form>
        </div>
    )
}