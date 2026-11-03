import type { SupabaseClient, User } from "@supabase/supabase-js"

export type AdminState = {
  user: User | null
  // app_metadata.role が admin
  isAdmin: boolean
  // admin かつ2段階認証済み（aal2）。DB の admin 権限もこのときだけ有効
  adminActive: boolean
}

export async function getAdminState(supabase: SupabaseClient): Promise<AdminState> {
  const { data: { user } } = await supabase.auth.getUser()
  const isAdmin = user?.app_metadata?.role === "admin"
  if (!user || !isAdmin) return { user, isAdmin: false, adminActive: false }
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  return { user, isAdmin, adminActive: data?.currentLevel === "aal2" }
}

// ?next= に指定された移動先のうち、サイト内のパスだけを許可する
export function safeNextPath(next: string | null, fallback = "/"): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback
}
