"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

type Profile = {
  name: string
  gender: string
  birth_year: number
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProfile = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("name, gender, birth_year")
        .eq("user_id", user.id)
        .maybeSingle()

      if (error) console.error(error)
      setProfile(data ?? { name: "", gender: "", birth_year: 0 })
      setLoading(false)
    }
    fetchProfile()
  }, [])

  if (loading) return <div>Loading...</div>

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">プロフィール</h1>
      <div className="mb-2"><strong>名前:</strong> {profile?.name || ""}</div>
      <div className="mb-2"><strong>性別:</strong> {profile?.gender || ""}</div>
      <div className="mb-2"><strong>生年:</strong> {profile?.birth_year || ""}</div>

      <div className="mt-4 flex flex-col gap-2">
        <Link
          href="/profile/edit"
          className="self-start px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          編集
        </Link>
        <Link
          href="/auth/update-password"
          className="self-start px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          パスワード変更
        </Link>
      </div>
    </div>
  )
}