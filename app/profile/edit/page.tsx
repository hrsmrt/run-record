"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

type Profile = {
    name: string
    gender: string
    birth_year: number
}

export default function ProfileEditPage() {
    const router = useRouter()
    const [profile, setProfile] = useState<Profile>({ name: "", gender: "", birth_year: 2000 })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchProfile = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data, error } = await supabase
                .from("profiles")
                .select("name, gender, birth_year")
                .eq("user_id", user.id)
                .maybeSingle()

            if (error) {
                console.error(error)
            } else if (data) {
                setProfile(data) // ←ここでフォームの初期値として設定
            }

            setLoading(false)
        }
        fetchProfile()
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
            .from("profiles")
            .upsert({
                user_id: user.id,
                name: profile.name ?? "",
                gender: profile.gender ?? "",
                birth_year: profile.birth_year ?? null,
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

    if (loading) return <div>Loading...</div>

    return (
        <div className="max-w-xl mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">プロフィール編集</h1>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <label>
                    名前:
                    <input
                        type="text"
                        value={profile.name ?? ""}
                        onChange={(e) => setProfile({ ...profile, name: e.target.value })}
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
                        onChange={(e) => setProfile({ ...profile, birth_year: Number(e.target.value) })}
                        className="border p-2 w-full"
                    />
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