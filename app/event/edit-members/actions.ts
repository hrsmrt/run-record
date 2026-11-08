"use server"

import { randomInt } from "crypto"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { MUST_CHANGE_PASSWORD, type ActionResult } from "@/lib/accounts"
import { parseEnrollmentYear } from "@/lib/enrollment"

// Server Action は画面を通さず直接呼ぶこともできるので、毎回ここで管理者（2段階認証済み）か確かめる
async function requireAdmin() {
    const supabase = await createClient()
    const { data } = await supabase.auth.getClaims()
    const claims = data?.claims
    if (!claims || claims.app_metadata?.role !== "admin" || claims.aal !== "aal2") return null
    return supabase
}

// 初期パスワード（読み間違えやすい 0 O 1 l I は使わない）
const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
const generatePassword = (length = 14) =>
    Array.from({ length }, () => PASSWORD_CHARS[randomInt(PASSWORD_CHARS.length)]).join("")

const errorMessage = (e: unknown) => e instanceof Error ? e.message : String(e)

export type NewAccount = {
    email: string
    // アカウントなしの人を引き継ぐときはその人の ID（名前などはその人の内容を使う）
    pendingId: string | null
    displayName: string
    name: string
    gender: string
    enrollmentYear: string
}

// アカウントを作り、プロフィールを作る（またはアカウントなしの人を紐付ける）。
// 初期パスワードは戻り値で1回だけ返し、どこにも保存しない
export async function createAccount(input: NewAccount): Promise<ActionResult<{ email: string; password: string; moved: number }>> {
    const supabase = await requireAdmin()
    if (!supabase) return { ok: false, error: "2段階認証済みの管理者のみ実行できます" }

    const email = input.email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "メールアドレスの形式が正しくありません" }
    const displayName = input.displayName.trim()
    const enrollmentYear = parseEnrollmentYear(input.enrollmentYear)
    if (!input.pendingId) {
        if (!displayName) return { ok: false, error: "表示名を入力してください" }
        if (input.gender !== "male" && input.gender !== "female") return { ok: false, error: "性別を選んでください" }
        if (enrollmentYear === undefined) return { ok: false, error: "入学年度は西暦4桁（例: 2017）で入力してください" }
    }

    let admin
    try { admin = createAdminClient() } catch (e) { return { ok: false, error: errorMessage(e) } }

    const password = generatePassword()
    const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        // 確認メールは送らず、作った時点で使えるようにする
        email_confirm: true,
        app_metadata: { [MUST_CHANGE_PASSWORD]: true },
    })
    if (error || !data.user) return { ok: false, error: `アカウントを作成できませんでした: ${error?.message ?? "不明なエラー"}` }
    const userId = data.user.id

    // 2段目が失敗したら、作ったアカウントを消して元に戻す
    let moved = 0
    if (input.pendingId) {
        // 管理者本人のログイン情報で呼ぶ（関数の中でも管理者か確かめ、1つのトランザクションで付け替える）
        const { data: count, error: linkError } = await supabase.rpc("admin_link_account", { p_pending_id: input.pendingId, p_user_id: userId })
        if (linkError) {
            await admin.auth.admin.deleteUser(userId)
            return { ok: false, error: `紐付けに失敗したため、アカウントの作成を取り消しました: ${linkError.message}` }
        }
        moved = count ?? 0
    } else {
        const { error: profileError } = await admin.from("profiles").insert({
            user_id: userId,
            name: input.name.trim() || displayName,
            display_name: displayName,
            gender: input.gender,
            enrollment_year: enrollmentYear,
        })
        if (profileError) {
            await admin.auth.admin.deleteUser(userId)
            return { ok: false, error: `プロフィールの作成に失敗したため、アカウントの作成を取り消しました: ${profileError.message}` }
        }
    }
    return { ok: true, email, password, moved }
}

// パスワードを再発行する（次のログインで変更を求める）。管理者・閲覧用アカウントは対象外
export async function resetPassword(userId: string): Promise<ActionResult<{ email: string; password: string }>> {
    if (!(await requireAdmin())) return { ok: false, error: "2段階認証済みの管理者のみ実行できます" }
    let admin
    try { admin = createAdminClient() } catch (e) { return { ok: false, error: errorMessage(e) } }

    const { data, error } = await admin.auth.admin.getUserById(userId)
    if (error || !data.user) return { ok: false, error: "アカウントが見つかりません" }
    const role = data.user.app_metadata?.role
    if (role === "admin" || role === "viewer") return { ok: false, error: "管理者・閲覧用アカウントのパスワードはここでは再発行できません" }

    const password = generatePassword()
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
        password,
        app_metadata: { ...data.user.app_metadata, [MUST_CHANGE_PASSWORD]: true },
    })
    if (updateError) return { ok: false, error: `再発行に失敗しました: ${updateError.message}` }
    return { ok: true, email: data.user.email ?? "", password }
}
