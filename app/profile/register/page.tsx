"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

type Profile = {
  name: string
  gender: string
  birth_year: number
}

export default function ProfileCreatePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile>({ name: "", gender: "", birth_year: 2000 })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert("ログインしてください")
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from("profiles")
      .insert({
        user_id: user.id,
        name: profile.name ?? "",
        gender: profile.gender ?? "",
        birth_year: profile.birth_year ?? null,
      })

    setLoading(false)

    if (error) {
      console.error(error)
      alert("プロフィール作成に失敗しました")
    } else {
      console.log("Created profile:", data)
      router.push("/profile")
    }
  }

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">プロフィール登録</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label>
          名前:
          <input
            type="text"
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            className="border p-2 w-full"
          />
        </label>

        <label>
          性別:
          <select
            value={profile.gender}
            onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
            className="border p-2 w-full"
          >
            <option value="">選択</option>
            <option value="male">男性</option>
            <option value="female">女性</option>
          </select>
        </label>

        <label>
          生年:
          <input
            type="number"
            value={profile.birth_year}
            onChange={(e) => setProfile({ ...profile, birth_year: Number(e.target.value) })}
            className="border p-2 w-full"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {loading ? "作成中..." : "登録"}
        </button>
      </form>
    </div>
  )
}
