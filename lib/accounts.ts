// アカウント関連で画面とサーバーの両方から使うもの

// 初回ログイン時にパスワード変更を求める印（app_metadata に置く。本人は書き換えられない）
export const MUST_CHANGE_PASSWORD = "must_change_password"

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string }
