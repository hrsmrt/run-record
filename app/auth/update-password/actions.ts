"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { MUST_CHANGE_PASSWORD, type ActionResult } from "@/lib/accounts"

// パスワードを変更し終えた本人の「初回変更が必要」の印を消す。
// app_metadata は本人には書き換えられないため、サーバー側で service_role を使う（対象はログイン中の本人のみ）
export async function finishPasswordChange(): Promise<ActionResult> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "ログインしてください" }
    if (user.app_metadata?.[MUST_CHANGE_PASSWORD] !== true) return { ok: true }
    try {
        const { error } = await createAdminClient().auth.admin.updateUserById(user.id, {
            app_metadata: { ...user.app_metadata, [MUST_CHANGE_PASSWORD]: false },
        })
        if (error) return { ok: false, error: error.message }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
    return { ok: true }
}
