import "server-only"
import { createClient } from "@supabase/supabase-js"

// secret キー（旧 service_role キー）のクライアント（RLS を無視できる全権限）。サーバー側でのみ使う。
// 環境変数は Supabase 連携が入れる SUPABASE_SERVICE_ROLE_KEY・SUPABASE_SECRET_KEY と分け、このアプリ専用のキーを入れる
// "server-only" により、ブラウザ側のコードから読み込むとビルドが失敗する
export function createAdminClient() {
    const key = process.env.APP_SUPABASE_SECRET_KEY
    if (!key) throw new Error("APP_SUPABASE_SECRET_KEY が設定されていません")
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    })
}
