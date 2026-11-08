import type { SupabaseClient } from "@supabase/supabase-js"
import { MUST_CHANGE_PASSWORD } from "@/lib/accounts"

// プロフィールがまだない本人を入力へ案内するための移動先
export const WELCOME_PROFILE_PATH = "/profile/edit?welcome=1"

export async function hasOwnProfile(supabase: SupabaseClient, userId: string) {
    const { data } = await supabase.from("profiles").select("user_id").eq("user_id", userId).maybeSingle()
    return data != null
}

// メンバーがログインした後の移動先。
// 初期パスワードのままならパスワード変更、プロフィールがなければプロフィール入力、それ以外はホーム
export async function pathAfterSignIn(supabase: SupabaseClient) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return "/"
    if (user.app_metadata?.[MUST_CHANGE_PASSWORD] === true) return "/auth/update-password?first=1"
    return (await hasOwnProfile(supabase, user.id)) ? "/" : WELCOME_PROFILE_PATH
}
